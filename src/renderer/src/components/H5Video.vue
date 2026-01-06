<!-- Video_component for SABAP platform in vue3 version -->
<!-- version: v0.2 -->
<!-- 支持长时精确帧与自动时间戳校对的新版本播放器 -->

<template>
    <video ref="video" type="video/mp4" :currentTime="currentTime" style="display: none;" id="video_render" @play="run_video()" v-on:ended="end()" :src="video_url" crossorigin="anonymous" controls></video>
    <div class="video_container" @mouseenter="seekbar_hover" @mouseleave="seekbar_unhover" ref="element">
        <!-- 视频展示-video -->
        <div id="video" class="video">
            <div v-if="state==0" style="width: 100%;height: 100%;display: flex;align-items: center;background-color: white;">
                <div style="margin: auto;" />
                <el-icon @click="load()" size="40px"><Film /></el-icon>
                <div style="margin: auto;" />
            </div>
            <div v-if="state==1" v-loading="true" style="width: 100%;height: 100%;background-color: black;" />
            <canvas v-if="state==2" class="video_canvas" id="video_canvas">
                不支持canvas
            </canvas>
            <div v-if="state==3">
                <el-result
                    icon="error"
                    title="Error"
                    :sub-title=error_info />
            </div>
        </div>
        <div class="video_controller">
            <div class="video_controller_button">
                <div style="margin: auto;"></div>
                <el-icon class="arrow_on" @click="video_previous()"><ArrowLeftBold /></el-icon>
                <div style="margin: auto;"></div>
                <el-icon class="arrow_on" v-if="video_isplay==false" @click="video_isplay=true;play_video()"><VideoPlay /></el-icon>
                <el-icon class="arrow_on" v-if="video_isplay!=false" @click="video_isplay=false;pause_video()"><VideoPause /></el-icon>
                <!-- <el-button :disabled="is_lock" v-if="video_timer==0" @click="video_isplay=true;play_video()" :icon="VideoPlay" size="small" circle></el-button>
                <el-button :disabled="is_lock" v-if="video_timer!=0" @click="video_isplay=false;pause_video()" :icon="VideoPause" size="small" circle></el-button> -->
                <div style="margin: auto;"></div>
                <el-icon class="arrow_on" @click="video_next()"><ArrowRightBold /></el-icon>
                <div style="margin: auto;"></div>
            </div>
            <div class="video_controller_seekbar">
                <div id="seekbar_button" class="seekbar_button">
                </div>
                <div id="seekbar_line" class="seekbar_line">
                </div>
                <div id="seekbar_line_blue" class="seekbar_line_blue">
                </div>
            </div>
            <div class="video_controller_right_button">
                <div style="margin: auto;" />
                <div v-if="is_lock">- / -</div>
                <div v-else>{{ g_frame_id+1 }} / {{ g_max_frame }}</div>
                <div style="margin: auto;" />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps(['data', 'goto']);
const selfEmit = defineEmits(['update']);

// 最新版本变量 ===============>
// 播放器状态
const state = ref(0);// 0-无 1-加载中 2-正常使用 3-错误
const error_info = ref("Default error."); // 错误信息

// 图像缓存
const g_frame = ref<HTMLCanvasElement>();
const video_isplay = ref(false);
const frame_rate = ref(0);
// 视频指针
const g_frame_id = ref(0);
// 视频最长长度
// const g_max_frame = ref('∞');
const g_max_frame = ref(0);
// 视频当前时间
const currentTime = ref(0);

// 可视化json
const g_json = ref<JSON>();

// 拖动相关变量
const drag_flag = ref(false);
const drag_x = ref(0);
const init_x = ref(0);
const video_process = ref(0.0);

// 全局解锁
const is_lock = ref(false);

// video_url for <video>
const video_url = ref('');

// ==========================>

// 监听大小
let resizeObserver;
const element = ref(null);

// 双列表精确帧缓冲列表=======>
const A_list = ref<HTMLCanvasElement[]>([]);
const A_point = ref(0);
const B_list = ref<HTMLCanvasElement[]>([]);
const B_point = ref(0);
const AB_flag = ref(0); // 0-A渲染 1-B渲染
const AB_len = 25; // 固定参数，缓存长度（推荐与帧数匹配）
const AB_preload_point = ref(0);
// ==========================>

// 整体初始化
onMounted(async()=>{
    // 组件初始化
    const seekbar_button = document.getElementById('seekbar_button');
    const zone = document.getElementById('zone');
    seekbar_button?.addEventListener('mousedown', drag_start);
    seekbar_button?.addEventListener('mousemove', drag_process);
    zone?.addEventListener('mousemove', drag_process);
    seekbar_button?.addEventListener('mouseup', drag_end);
    zone?.addEventListener('mouseup', drag_end);

    // 监听变化
    resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const cr = entry.contentRect;
        console.log('Element size changed:', cr.width, cr.height);
        draw_select();
      }
    });
    resizeObserver.observe(element.value);
})

// 数据驱动-加载视频
watch(()=>props.data, async(_)=>{
    alert('video_loading...')
    console.log('video_loading...', _);
    load();
})

// 视频与json内容加载
const load=async()=>{
    state.value = 1;
    try{
        if(check(props.data)){
            await load_video(props.data['video_url']);
            await load_coco_json(props.data['coco_json']);

            // 延迟动画
            await sleep(1000);
            state.value=2;
            // AB预加载
            load_AB();
            await sleep(1000);
        }
        else{
            state.value=0;
        }
    }
    catch(error){
        state.value=3;
        error_info.value = error as string;
    }
}

const check=(value)=>{
    if(value['video_url']==undefined || value['video_url']==''){
        return false;
    }
    if(value['coco_json']==undefined || value['coco_json']==''){
        return false;
    }
    return true;
}

const load_video=async(url)=>{
    // 帧数加载
    get_frame_num(url);
    g_frame_id.value = 0;
    
    // 自定义协议加载视频至解码器
    let protocol_url = "atom://"+url.replace(":","&").replace("\\","/");
    video_url.value= protocol_url;
}

const load_coco_json=async(url)=>{
    // json加载
    var json = await window['video_api'].api_open_json(url);
    g_json.value = json;
    console.log('json', g_json.value);
}

const get_frame_num=async(url)=>{
    frame_rate.value = await window['video_api'].get_frame(url);
    g_max_frame.value = parseFloat(frame_rate.value['streams'][0]['nb_frames']);
}

// 随机颜色生成器
const generateRandomColor=(item)=> {  
  const randomRed = Math.floor((item*3)%1 * 256);  // 生成一个0到255之间的随机整数，代表红色通道的值。
  const randomGreen = Math.floor((1/2+item>=1?item:1/2+item) * 256);  // 生成一个0到255之间的随机整数，代表绿色通道的值。
  const randomBlue = Math.floor((item*4)%1 * 256);  // 生成一个0到255之间的随机整数，代表蓝色通道的值。
  return `rgb(${randomRed}, ${randomGreen}, ${randomBlue})`;  // 返回一个字符串，格式为rgb(red, green, blue)
}

const lock=()=>{
    is_lock.value=true;
    state.value=1;
}
const unlock=async()=>{
    is_lock.value=false;
    state.value=2;
    await sleep(1000);
    var canvas:HTMLCanvasElement = document.getElementById('video_canvas')! as HTMLCanvasElement;
    canvas.addEventListener('mousemove', function(event) {
        // 获取鼠标相对于canvas的位置
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left; // x position within the element.
        const y = event.clientY - rect.top; // y position within the element.
        console.log('canvas_point', x, y);
        check_is_in(x,y);
    });

    canvas.addEventListener('mousedown', function(event) {
        // 获取鼠标相对于canvas的位置
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left; // x position within the element.
        const y = event.clientY - rect.top; // y position within the element.
        console.log('canvas_point', x, y);
        check_is_in(x,y,true);
    });
}

const check_is_in=(x,y,is_al=false)=>{
    if(g_json.value==undefined){return}
    var temp:any[] = [];
    var p = prepare_video_data();
    if(p==undefined){return};

    for(let i=0;i<g_json.value['annotations'].length;i++){
        if(g_json.value['annotations'][i]['image_id']==g_frame_id.value){
            temp.push(g_json.value['annotations'][i]);
        }
    }
    for(let k=0;k<temp.length;k++){
        if(p[0]+temp[k]['bbox'][0]/p[4]<=x &&
           p[1]+temp[k]['bbox'][1]/p[4]<=y &&
           p[0]+temp[k]['bbox'][0]/p[4]+temp[k]['bbox'][2]/p[4]>=x &&
           p[1]+temp[k]['bbox'][1]/p[4]+temp[k]['bbox'][3]/p[4]>=y
        ){
            draw_select(k);
            if(is_al){
                alert('itentity_id:'+k+" frame_id:"+g_frame_id.value);
            }
            return;
        }
    }
    draw_select();
}

const draw_select=(id=-1)=>{
    var _canvas:HTMLCanvasElement = document.getElementById('video_canvas')! as HTMLCanvasElement;
    if(_canvas==null){return};
    const canvas = document.createElement('canvas');
    canvas.width=_canvas.clientWidth;
    canvas.height=_canvas.clientHeight;

    var ctx = canvas.getContext('2d');
    if(ctx==null){return};
    var p = prepare_video_data();
    if(p==undefined){return};
    if(g_frame.value==null){return};
    ctx.drawImage(g_frame.value, 0, 0, g_frame.value.width, g_frame.value.height, p[0], p[1], p[2], p[3]);

    // 数据准备
    if(g_json.value!=undefined){
        // 数据准备
        var temp:any[] = [];
        for(let i=0;i<g_json.value['annotations'].length;i++){
            if(g_json.value['annotations'][i]['image_id']==g_frame_id.value){
                temp.push(g_json.value['annotations'][i]);
            }
        }

        // 绘制bbox
        for(let k=0;k<temp.length;k++){
            ctx.strokeStyle=generateRandomColor(k/temp.length);
            //边框
            ctx.strokeRect(p[0]+temp[k]['bbox'][0]/p[4], p[1]+temp[k]['bbox'][1]/p[4], temp[k]['bbox'][2]/p[4], temp[k]['bbox'][3]/p[4]);
            // id
            ctx.font = '10px Arial';
            ctx.fillStyle = generateRandomColor(k/temp.length);
            ctx.fillRect(p[0]+temp[k]['bbox'][0]/p[4], p[1]+temp[k]['bbox'][1]/p[4] - 10, 30, 10);
            ctx.fillStyle='black';
            ctx.fillText(' ID:'+String(k), p[0]+temp[k]['bbox'][0]/p[4], p[1]+temp[k]['bbox'][1]/p[4]); // 在框的上方显示标签
            if(id!=-1 && id==k){
                ctx.fillStyle='rgba(64,110,199, 0.6)';
                ctx.fillRect(p[0]+temp[k]['bbox'][0]/p[4], p[1]+temp[k]['bbox'][1]/p[4], temp[k]['bbox'][2]/p[4], temp[k]['bbox'][3]/p[4]);
            }
        }
        
        // 绘制关键点
        for(let k=0;k<temp.length;k++){
            for(let j=0;j<temp[k]['keypoints'].length;j+=3){
                ctx.fillStyle=generateRandomColor(k/temp.length);;
                ctx.beginPath();
                ctx.arc(p[0]+temp[k]['keypoints'][j]/p[4], p[1]+temp[k]['keypoints'][j+1]/p[4], 1, 0, Math.PI * 100); // x, y 是圆心的坐标，1 是半径，0 和 Math.PI * 2 是起始和结束角度，表示一个完整的圆
                ctx.fill(); // 使用当前的填充样式填充圆形
            }
        }
    }
    
    // 双缓存刷新
    var _ctx = _canvas.getContext('2d')!;

    // 清空
    _ctx.clearRect(0, 0, _canvas.clientWidth, _canvas.clientHeight);
    _ctx.drawImage(canvas,0,0);
}

// AB精确帧双列表加载（视频总体初始化、进度条拖动后调用）
const load_AB=async(address='left')=>{
    // preload
    AB_preload_point.value=0;
    A_point.value=0;
    B_point.value=0;
    const video:HTMLVideoElement = document.getElementById('video_render')! as HTMLVideoElement;

    // create list
    const image = document.createElement('canvas');
    let temp:HTMLCanvasElement[] = [];
    for(let i=0;i<AB_len;i++){
        temp.push(image);
    }
    A_list.value = temp;
    B_list.value = temp;
    
    // 加锁
    lock();
    const fr = () => {
        video.requestVideoFrameCallback(async(now, metadata) => {
            // if(abs_address.value++<15){
            //     fr();
            //     console.log("过帧"+String(abs_address.value));
            //     return;
            // }
            const video_data:HTMLVideoElement = document.getElementById('video_render')! as HTMLVideoElement;
            // 复制为图像元素
            const canvas = document.createElement('canvas');
            canvas.width=video_data.videoWidth;
            canvas.height=video_data.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video_data, 0, 0, canvas.width, canvas.height);

            A_list.value[AB_preload_point.value++]=canvas;
            if(AB_preload_point.value==AB_len){
                // 停止
                video_data.pause();
                // 解锁
                exchange_AB('A');
                unlock();
                console.log("AB_LIST", A_list.value);
                if(address=='right'){
                    A_point.value=24;
                    B_point.value=24;
                }
                await sleep(100);
                run_video('static');
            }
            else{
                fr();
            }
        });
    }
    video.play();
    fr();

    while(true){
        if(is_lock.value==false){
            return;
        }
        await sleep(5);
    }
}
const exchange_AB=(val)=>{
    if(val=='A'){
        AB_flag.value = 0;
    }
    else if(val=='B'){
        AB_flag.value = 1;
    }
    A_point.value=0;
    B_point.value=0;
}

// 渲染当前帧
const run_video=async(type='next')=>{
    /**
     * type决定当前渲染列表向前或向后
     * -- next: 正常顺序播放
     * -- next_once: 只播放下一帧
     * -- previous_once: 只播放上一帧
     * -- static: 只播放当前帧（一般用于首帧渲染）
     */
    if(is_lock.value){
        return;
    }

    const get_data=()=>{
        const video_data:HTMLVideoElement = document.getElementById('video_render')! as HTMLVideoElement;
        // 复制为图像元素
        const canvas = document.createElement('canvas');
        canvas.width=video_data.videoWidth;
        canvas.height=video_data.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video_data, 0, 0, canvas.width, canvas.height);
        return canvas;
    }
    // 更新AB列表&&获取当前帧信息
    console.log('AB_flag.value',AB_flag.value);
    
    // alert(A_point.value);
    // alert(g_frame_id.value);

    // 帧数校准
    if( type=='next' || type=='next_once' ){
        A_point.value++;
        B_point.value++;
        
        if(g_frame_id.value<g_max_frame.value-1){
            g_frame_id.value+=1;
        }
    }
    if(type=='previous_once'){
        A_point.value--;
        B_point.value--;
        
        if(g_frame_id.value>0){
            g_frame_id.value-=1;
        }
    }
    
    let is_change_track = false;
    // 换位
    if(AB_flag.value==0 && (A_point.value==AB_len || A_point.value==-1)){
        exchange_AB('B');
        is_change_track=true;
    }
    else if(AB_flag.value==1 && (B_point.value==AB_len || B_point.value==-1)){
        exchange_AB('A');
        is_change_track=true;
    }

    if(AB_flag.value==0){
        g_frame.value = A_list.value[A_point.value];
        B_list.value[B_point.value] = get_data();
    }
    else if(AB_flag.value==1){
        g_frame.value = B_list.value[B_point.value];
        A_list.value[A_point.value] = get_data();
    }

    const video:HTMLVideoElement = document.getElementById('video_render')! as HTMLVideoElement;
    var _canvas:HTMLCanvasElement = document.getElementById('video_canvas')! as HTMLCanvasElement;
    if(_canvas==null){return};
    const canvas = document.createElement('canvas');
    canvas.width=_canvas.clientWidth;
    canvas.height=_canvas.clientHeight;

    var ctx = canvas.getContext('2d');
    if(ctx==null){return};
    var p = prepare_video_data();
    if(p==undefined){return};
    if(g_frame.value==null){return};
    ctx.drawImage(g_frame.value, 0, 0, g_frame.value.width, g_frame.value.height, p[0], p[1], p[2], p[3]);

    // 数据准备
    if(g_json.value!=undefined){
        // 数据准备
        var temp:any[] = [];
        for(let i=0;i<g_json.value['annotations'].length;i++){
            if(g_json.value['annotations'][i]['image_id']==g_frame_id.value){
                temp.push(g_json.value['annotations'][i]);
            }
        }

        // 绘制bbox
        for(let k=0;k<temp.length;k++){
            ctx.strokeStyle=generateRandomColor(k/temp.length);
            //边框
            ctx.strokeRect(p[0]+temp[k]['bbox'][0]/p[4], p[1]+temp[k]['bbox'][1]/p[4], temp[k]['bbox'][2]/p[4], temp[k]['bbox'][3]/p[4]);
            // id
            ctx.font = '10px Arial';
            ctx.fillStyle = generateRandomColor(k/temp.length);
            ctx.fillRect(p[0]+temp[k]['bbox'][0]/p[4], p[1]+temp[k]['bbox'][1]/p[4] - 10, 30, 10);
            ctx.fillStyle='black';
            ctx.fillText(' ID:'+String(k), p[0]+temp[k]['bbox'][0]/p[4], p[1]+temp[k]['bbox'][1]/p[4]); // 在框的上方显示标签
        }
        
        // 绘制关键点
        for(let k=0;k<temp.length;k++){
            for(let j=0;j<temp[k]['keypoints'].length;j+=3){
                ctx.fillStyle=generateRandomColor(k/temp.length);;
                ctx.beginPath();
                ctx.arc(p[0]+temp[k]['keypoints'][j]/p[4], p[1]+temp[k]['keypoints'][j+1]/p[4], 1, 0, Math.PI * 100); // x, y 是圆心的坐标，1 是半径，0 和 Math.PI * 2 是起始和结束角度，表示一个完整的圆
                ctx.fill(); // 使用当前的填充样式填充圆形
            }
        }
    }
    

    // 双缓存刷新
    var _ctx = _canvas.getContext('2d')!;

    // 清空
    _ctx.clearRect(0, 0, _canvas.clientWidth, _canvas.clientHeight);
    _ctx.drawImage(canvas,0,0);

    set_seekbar_button();

    if(is_change_track && !video_isplay.value){
        if(type=='next_once'){
            await go_to(g_frame_id.value);
            await load_AB();
        }
        else if(type=='previous_once'){
            await go_to(g_frame_id.value, 'top');
            await load_AB('right');
        }
    }

    // 状态检查
    if(g_frame_id.value+1==g_max_frame.value){
        video_isplay.value=false;
    }
    
    // 回调函数自调用（持续播放时）
    if(video_isplay.value && !drag_flag.value){
        video.requestVideoFrameCallback((now, metadata) => {
            // console.log('metadata', metadata)
            // console.log('now', now)
            if(type=='next' && video_isplay.value){
                run_video('next');
            }
            // alert('Next frame.');
        });
    }
}

watch(()=>g_frame_id, (newVal)=>{
    console.log(newVal);
    selfEmit('update', newVal.value);
},{deep:true})

watch(()=>props.goto, async(newVal)=>{
    go_to(newVal);
    load_AB();
},{deep:true})

// 进度条按钮显示
const seekbar_hover=()=>{
    const seekbar_button = document.getElementById('seekbar_button') ? document.getElementById('seekbar_button') : null;
    if (seekbar_button!=null){
        seekbar_button.style.opacity='1';
    }
}
const seekbar_unhover=()=>{
    const seekbar_button = document.getElementById('seekbar_button') ? document.getElementById('seekbar_button') : null;
    if (seekbar_button!=null){
        seekbar_button.style.opacity='0';
    }
}

const drag_start=(e)=>{ 
    // if(is_lock.value==true){
    //     return;
    // }  
    console.log('draginh...');
    if(drag_flag.value==true){
        e.stopPropagation();
        e.preventDefault();
        return;
    }
    if(video_isplay.value!=false){
        pause_video();
    }
    drag_flag.value=true;
    // is_limit_graph.value=true;
    init_x.value=e.x;
}
const drag_process=(e)=>{
    // if(is_lock.value==true){
    //     return;
    // }
    if(drag_flag.value==true){
        e.stopPropagation();
        e.preventDefault();
        drag_x.value=e.x-init_x.value;
        move_seekbar_button();
    }
}
const drag_end=()=>{
    if(is_lock.value==true){
        return;
    }
    if(drag_flag.value==true){
        drag_flag.value=false;
        // is_limit_graph.value=false;
        if(video_isplay.value!=false){
            play_video();
        }
        set_seekbar_button();
        // 帧刷新
        go_to(g_frame_id.value);
        load_AB();
    }
    return;
}


const end=()=>{
    // video_isplay.value=false;
    currentTime.value = 0;
    const video:HTMLVideoElement = document.getElementById('video_render')! as HTMLVideoElement;
    video.play();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//视频播放
const play_video=async()=>{

    // 新策略 -> 检查当前帧是否匹配帧率整数倍+1，匹配则直接播放，不匹配则尝试匹配！
    if(g_frame_id.value%25!=0){
        // alert(g_frame_id.value)
        // alert(25)
        // alert(g_frame_id.value%25)
        // 匹配最近值（向下）
        await go_to(g_frame_id.value);
        await load_AB();
    }
    // alert('start');
    const video:HTMLVideoElement = document.getElementById('video_render')! as HTMLVideoElement;
    if(g_frame_id.value==g_max_frame.value-1){video_isplay.value=false;return}
    if(video==null){return;}
    video.play();
}


//视频暂停
const pause_video=()=>{
    // if(is_lock.value==true){
    //     return;
    // }
    const video:HTMLVideoElement = document.getElementById('video_render')! as HTMLVideoElement;
    if(video==null){return;}
    video.pause();
}

const video_next=()=>{
    if(is_lock.value==true){
        return;
    }
    if(g_frame_id.value+1>=g_max_frame.value){
        return;
    }
    run_video("next_once");
}

const video_previous=()=>{
    if(is_lock.value==true){
        return;
    }
    if(g_frame_id.value<=0){
        return;
    }
    run_video("previous_once");
}

//拖动进度条
const move_seekbar_button=()=>{
    if(is_lock.value==true){
        return;
    }
    const seekbar_button = document.getElementById('seekbar_button') ? document.getElementById('seekbar_button') : null;
    const seekbar_line = document.getElementById('seekbar_line') ? document.getElementById('seekbar_line') : null;
    if (seekbar_button!=null && seekbar_line!=null){
        const seekbar_button_container = seekbar_button.parentElement ? seekbar_button.parentElement: null;
        if (seekbar_button_container!=null){
            let width = seekbar_button.offsetWidth / 1.0;
            console.log(width);
            console.log(width/2);
            console.log(seekbar_line.getBoundingClientRect().left, (init_x.value + drag_x.value - width/2), seekbar_line.getBoundingClientRect().right);
            if( (init_x.value + drag_x.value +width/2)>=seekbar_line.getBoundingClientRect().right 
            || (init_x.value + drag_x.value - width/2)<seekbar_line.getBoundingClientRect().left){
                return;
            }
            seekbar_button.style.left = init_x.value + drag_x.value - seekbar_button_container.getBoundingClientRect().left - width/2 + "px";
            console.log(seekbar_button_container.getBoundingClientRect().left);
            video_process.value = (seekbar_button.getBoundingClientRect().left-seekbar_button_container.getBoundingClientRect().left)/(seekbar_button_container.offsetWidth - width);
            if (video_process.value<=0.005){
                video_process.value=0;
            }
            if (video_process.value>=0.995){
                video_process.value=1;
            }

            g_frame_id.value = Math.floor(Number(g_max_frame.value*video_process.value));

            // // 帧刷新
            // go_to(g_frame_id.value);
        }
    }
    // 蓝色进度条
    const seekbar_line_blue = document.getElementById('seekbar_line_blue') ? document.getElementById('seekbar_line_blue') : null;
    if (seekbar_line_blue!=null){
        seekbar_line_blue.style.width=video_process.value*100+'%';
    }
}

const go_to=(t, type='bottom')=>{
    if(type=='bottom'){
        currentTime.value = Math.floor(t/25);
    }
    else if (type=='top'){
        currentTime.value = Math.ceil(t/25);
    }
    g_frame_id.value = currentTime.value*25;
    if(type=='top'){
        g_frame_id.value--;
    }
    set_seekbar_button();

    const video:HTMLVideoElement = document.getElementById('video_render')! as HTMLVideoElement;
    video.pause();
    video.currentTime = currentTime.value;
}

const set_seekbar_button=()=>{
    const seekbar_button = document.getElementById('seekbar_button') ? document.getElementById('seekbar_button') : null;
    const seekbar_line = document.getElementById('seekbar_line') ? document.getElementById('seekbar_line') : null;
    if (seekbar_button!=null && seekbar_line!=null){
        const seekbar_button_container = seekbar_button.parentElement ? seekbar_button.parentElement: null;
        if (seekbar_button_container!=null){
            let width = seekbar_button.offsetWidth / 1.0; 
            // 调整位置
            seekbar_button.style.left = (seekbar_button_container.getBoundingClientRect().right - seekbar_button_container.getBoundingClientRect().left - width)*((g_frame_id.value)/(g_max_frame.value-1)) + "px";
            // console.log('test_for_control_button',(seekbar_button_container.getBoundingClientRect().right - seekbar_button_container.getBoundingClientRect().left)*(now_frame.value/g_max_frame.value) + width/2 + "px");
            // console.log(seekbar_button_container.getBoundingClientRect().left);
            video_process.value = (seekbar_button.getBoundingClientRect().left-seekbar_button_container.getBoundingClientRect().left)/(seekbar_button_container.offsetWidth - width);
            if (video_process.value<=0.005){
                video_process.value=0;
            }
            if (video_process.value>=0.995){
                video_process.value=1;
            }
        }
    }
    // 蓝色进度条
    const seekbar_line_blue = document.getElementById('seekbar_line_blue') ? document.getElementById('seekbar_line_blue') : null;
    if (seekbar_line_blue!=null){
        seekbar_line_blue.style.width=video_process.value*100+'%';
    }
}

const prepare_video_data=()=>{
    if(g_frame.value==undefined){return};
    // 原点标定
    // let height=test_frame.value['height'];
    let height=g_frame.value.height;
    // let width=test_frame.value['width'];
    let width=g_frame.value.width;

    var canvas = document.getElementById('video_canvas')! as HTMLCanvasElement;
    if (canvas==null){return;}
    // 重置宽高
    // var canvas_border = document.getElementById('video_canvas');
    // if (canvas_border==null){return;}
    // canvas.height = canvas_border.clientHeight;
    // canvas.width = canvas_border.clientWidth;
    if(canvas.height!=canvas.clientHeight){
        canvas.height = canvas.clientHeight;
    }
    if(canvas.width!=canvas.clientWidth){
        canvas.width = canvas.clientWidth;
    }
    
    let _height = canvas.clientHeight;
    let _width = canvas.clientWidth;
    var x_0=0, y_0=0, x_1=0, y_1=0;
    let ratio_image = width / height;
    let ratio_canvas = _width / _height;
    let x0=0;let y0=0;let ratio=1;
    if(ratio_image>=ratio_canvas){
        ratio=width/_width;
        //坐标处理
        x0=0;
        y0=(_height-height/ratio)/2;
        x_0=x0;
        y_0=y0;
        x_1=width/ratio;
        y_1=height/ratio;
    }
    else{
        ratio=height/_height;
        //坐标处理
        y0=0;
        x0=(_width-width/ratio)/2;
        x_0=x0;
        y_0=y0;
        x_1=width/ratio;
        y_1=height/ratio;
    }

    console.log('pre_data',x_0, y_0, x_1, y_1, ratio)
    return [x_0, y_0, x_1, y_1, ratio];
}
</script>

<style scoped>
.video_container {
    height: calc(100% - 10px);
    width: calc(100% - 10px);
    /* margin: 2%; */
    /* border: 1px solid #00AEEC; */
    margin: 5px;
}
.video {
    height: 85%;
}
.video_controller {
    height: 15%;
    display: flex;
    background-color: white;
}
.video_controller_button {
    width: 20%;
    position: relative;
    display: flex;
    align-items: center;
    background-color:white;
}
.video_controller_seekbar {
    width: 65%;
    position: relative;
    display: flex;
    align-items: center;
    margin-left: 1%;
    margin-right: 1%;
}
.video_controller_right_button {
    width: 15%;
    position: relative;
    display: flex;
    align-items: center;
    background-color:white;
}
.seekbar_button{
    height: 15px;
    aspect-ratio: 1;
    background-color: white;
    position: absolute;
    left: 0px;
    /* top: 0px; */
    z-index: 3;
    border-radius: 50%;
    opacity: 0;
    border: 1px solid #334141;
}
.seekbar_line {
    width: 100%;
    height: 10px;
    background-color: #868A9E;
    position: absolute;
    left: 0px;
    z-index: 1;
    border-radius: 5px;
    overflow: hidden;
}
.seekbar_line_blue {
    width: 0%;
    height: 10px;
    background-color: #00AEEC;
    position: absolute;
    left: 0px;
    z-index: 2;
    border-radius: 5px 5px 5px 5px;
    overflow: hidden;
}
.video_canvas {
    width: 100%;
    height: 100%;
    background-color: aliceblue;
}
</style>