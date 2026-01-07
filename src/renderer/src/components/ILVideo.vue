<!-- Video_component for SABAP platform in vue3 version -->

<template>
    <div class="vc" @mouseenter="seekbar_hover" @mouseleave="seekbar_unhover">
        <!-- 视频展示-video -->
        <div id="video" class="video">
            <canvas class="video_canvas" id="video_canvas">
                不支持canvas
            </canvas>
        </div>
        <div class="video_controller">
            <div class="video_controller_button">
                <div style="margin: auto;"></div>
                <el-icon class="arrow_on" @click="video_previous()"><ArrowLeftBold /></el-icon>
                <div style="margin: auto;"></div>
                <el-icon class="arrow_on" v-if="g_video_timer==0" @click="video_isplay=true;play_video()"><VideoPlay /></el-icon>
                <el-icon class="arrow_on" v-if="g_video_timer!=0" @click="video_isplay=false;pause_video()"><VideoPause /></el-icon>
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
import { ref, onMounted, onActivated, watch } from 'vue'

const props = defineProps(['data', 'goto']);
// const props = defineProps(['type', 'data', 'goto']);
const selfEmit = defineEmits(['update']);

// 新版本变量 ===============>
// 图像列表
interface Image {
  id: number
  url: string,
  height: number,
  width: number
};
const images = ref<Image[]>([]);

// 缓冲列表
interface Cache {
    type:number // 0 占位 1 使用 2 卸载
    data?:HTMLImageElement
}
const cache = ref<Cache[]>([]);

// 视频最长长度
const g_max_frame = ref(3);

// 视频指针
const g_frame_id = ref(0);

// 视频播放间隔时长ms
const g_video_time_stamp = ref(70);

// 视频计时器
const g_video_timer = ref<number|NodeJS.Timeout>(0);

// 可视化json
const g_json = ref<JSON>();

// ==========================>

const video_select = ref('');
const track_select = ref('');


// 基础地址
const url_imgs = ref('');
const url_track = ref('');
// 视频缓存数据
// const cache = ref([]);

const video_isplay = ref(false);

// 拖动相关变量
const drag_flag = ref(false);
const drag_x = ref(0);
const init_x = ref(0);
const video_process = ref(0.0);

// 全局解锁
const is_lock = ref(false);

// 图表限流
const is_limit_graph=ref(false);


// 定制化API
// 加载图包为主
const load_imgv=async(data)=>{
    // alert(1)
    load_basic();
    // data:{
    //     video_url:xxx,
    //     result_url:xxx
    // }
    // 视频列表加载
    var video_url = data['video_url'];
    var result_url = data['coco_json'];
    var result_json = await window['video_api'].api_open_json(result_url);

    // imgs = [
    //     {
    //         id:0,
    //         url:xxx,
    //         height:xxx,
    //         width:xxx
    //     },
    //     {
    //         id:1,
    //         url:xxx
    //     }
    //     ...
    // ]
    var _images:Image[] = [];
    for(let i=0;i<result_json['images'].length;i++){
        var temp = {
            id:result_json['images'][i]['id'],
            url:video_url+'\\'+result_json['images'][i]['file_name'],
            height:result_json['images'][i]['height'],
            width:result_json['images'][i]['width']
        }
        _images.push(temp);
    }
    images.value = _images;
    console.log('images', images.value);
    // 视频参数加载
    g_max_frame.value = images.value.length;
    // 加载流程结束，直接载入
    ready();

    // 可视化文件加载
    var json = result_json;
    g_json.value = json;
    console.log('json', g_json.value);
}

const load_basic=()=>{
    // const seekbar_button = document.getElementById('seekbar_button');
    // const zone = document.getElementById('zone');
    // seekbar_button?.addEventListener('mousedown', drag_start);
    // seekbar_button?.addEventListener('mousemove', drag_process);
    // zone?.addEventListener('mousemove', drag_process);
    // seekbar_button?.addEventListener('mouseup', drag_end);
    // zone?.addEventListener('mouseup', drag_end);

    // alert(233);
}

const ready=async()=>{
    // 图像初缓冲
    await video_cache(0);
    // 准备绘制流程
    await draw_canvas();
}

watch(()=>props.data, (newVal)=>{
    // alert(newVal);
    console.log('newVal', newVal);
    if(newVal['coco_json']!=undefined && newVal['video_url']!=undefined){
        load_imgv(newVal);
    }

    load_basic();
},{deep:true})

watch(()=>props.goto, async(newVal)=>{
    // alert(newVal);
    console.log('newVal', newVal);
    g_frame_id.value=newVal;
    await video_cache(g_frame_id.value);
    draw_canvas();
    set_seekbar_button();
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
    if(drag_flag.value==true){
        e.stopPropagation();
        e.preventDefault();
        return;
    }
     if(g_video_timer.value!=0){
        pause_video();
    }
    drag_flag.value=true;
    is_limit_graph.value=true;
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
    // if(is_lock.value==true){
    //     return;
    // }
    drag_flag.value=false;
    // is_limit_graph.value=false;
    if(g_video_timer.value!=0){
        play_video();
    }
    set_seekbar_button();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//视频播放
const play_video=()=>{
    // if(is_lock.value==true){
    //     return;
    // }
    // timer初始化
    if(g_video_timer.value==0 && g_frame_id.value+1<=g_max_frame.value){
        g_video_timer.value=setInterval(async function(){
            await run_video();
            if(g_frame_id.value+1>=g_max_frame.value){
                pause_video();
            }
        },g_video_time_stamp.value);
    }
}

const run_video=async()=>{
    
    // now_frame.value = Math.round(Number(g_max_frame.value*video_process.value));
    // now_frame.value+=1;
    // test_frame.value=analysis_data.value['video']['images'][now_frame.value];
    // // 所有数据更新
    // prepare_line_data();
    if(g_frame_id.value+1>=g_max_frame.value){
        pause_video();
        return;
    }
    // // 帧刷新
    g_frame_id.value+=1;
    await draw_canvas();
    

    // 进度刷新
    set_seekbar_button();
}

//视频暂停
const pause_video=()=>{
    // if(is_lock.value==true){
    //     return;
    // }
    clearInterval(g_video_timer.value);
    g_video_timer.value=0;
}


const video_next=()=>{
    // if(is_lock.value==true){
    //     return;
    // }
    if(g_frame_id.value+1>=g_max_frame.value){
        return;
    }
    g_frame_id.value+=1;
    // test_frame.value=analysis_data.value['video']['images'][now_frame.value];
    // 所有数据更新
    // prepare_line_data();

    // 帧刷新
    // prepare_video_data();
    set_seekbar_button();
    draw_canvas();
}

const video_previous=()=>{
    // if(is_lock.value==true){
    //     return;
    // }
    if(g_frame_id.value<=0){
        return;
    }
    // now_frame.value = now_frame.value-1;
    // test_frame.value=analysis_data.value['video']['images'][now_frame.value];
    // // 所有数据更新
    // prepare_line_data();

    // // 帧刷新
    // prepare_video_data();
    // set_seekbar_button();
    g_frame_id.value-=1;
    set_seekbar_button();
    draw_canvas();
}

//拖动进度条
const move_seekbar_button=()=>{
    // if(is_lock.value==true){
    //     return;
    // }
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
            // now_frame.value = Math.round(Number(g_max_frame.value*video_process.value));
            g_frame_id.value = Math.floor(Number(g_max_frame.value*video_process.value));
            // test_frame.value=analysis_data.value['video']['images'][now_frame.value];
            // // 所有数据更新
            // prepare_line_data();

            // // 帧刷新
            // prepare_video_data();
            draw_canvas();
        }
    }
    // 蓝色进度条
    const seekbar_line_blue = document.getElementById('seekbar_line_blue') ? document.getElementById('seekbar_line_blue') : null;
    if (seekbar_line_blue!=null){
        seekbar_line_blue.style.width=video_process.value*100+'%';
    }
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

// 缓存模块，只输入所需帧即可
const video_cache=async (frame_id)=>{
    let list_num = 5;
    // 缓存初始化
    if(cache.value.length==0){
        for(let i=0;i<g_max_frame.value;i++){
            // 缓冲占位
            cache.value.push({
                type:0
            });
        }
        let max = list_num>g_max_frame.value?g_max_frame.value:list_num;
        for(let i=0;i<max;i++){
            // var src = url_imgs.value+"\\"+video_select.value+"\\"+analysis_data.value['video']['images'][i]['file_name']; 
            var src = images.value[i].url; 
            var image = new Image();
            image.src = 'data:image/png;base64,' + await window['video_api'].analysis_load_image(src);
            let isEnd=false;
            image.onload=function(){
                isEnd=true;
            }
            while(!isEnd){
                await sleep(1);
            }
            cache.value[i]={
                type:1,
                data:image
            };
        }
        console.log(cache.value);
        g_frame_id.value=0;

        return cache.value[frame_id];
    }
    // 缓存未命中
    if(cache.value[frame_id].type==0){
        let max = frame_id+list_num<=g_max_frame.value?frame_id+list_num:g_max_frame.value;
        for(let i=frame_id-list_num>=0?frame_id-list_num:0;i<max;i++){
            // var src = url_imgs.value+"\\"+video_select.value+"\\"+analysis_data.value['video']['images'][i]['file_name']; 
            var src = images.value[i].url; 
            var image = new Image();
            image.src = 'data:image/png;base64,' + await window['video_api'].analysis_load_image(src);
            let isEnd=false;
            image.onload=function(){
                isEnd=true;
            }
            while(isEnd){
                await sleep(1);
            }
            cache.value[i]={
                type:1,
                data:image
            };
        }
        return cache.value[frame_id];
    }
    // 缓存命中 
    else{
        // 更新缓存
        let max = frame_id+list_num<=g_max_frame.value?frame_id+list_num:g_max_frame.value;
        for(let i=frame_id-list_num>=0?frame_id-list_num:0;i<max;i++){
            if(cache.value[i].type==0){
                // var src = url_imgs.value+"\\"+video_select.value+"\\"+analysis_data.value['video']['images'][i]['file_name']; 
                var src = images.value[i].url; 
                var image = new Image();
                image.src = 'data:image/png;base64,' + await window['video_api'].analysis_load_image(src);
                cache.value[i]={
                    type:1,
                    data:image
                };
            }
        }
        console.log(cache.value);
        return cache.value[frame_id];
    }
    // 缓存卸载
    // ...
}

const prepare_video_data=async()=>{
    // 原点标定
    // let height=test_frame.value['height'];
    let height=images.value[g_frame_id.value].height;
    // let width=test_frame.value['width'];
    let width=images.value[g_frame_id.value].width;

    var canvas = document.getElementById('video_canvas');
    if (canvas==null){return;}
    // 重置宽高
    var canvas_border = document.getElementById('video_canvas');
    if (canvas_border==null){return;}
    canvas.height = canvas_border.clientHeight;
    canvas.width = canvas_border.clientWidth;
    let _height = canvas.height;
    let _width = canvas.width;
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
    // 缓存
    video_cache(g_frame_id.value);
    // 更新值
    selfEmit('update', g_frame_id.value);
    return [x_0, y_0, x_1, y_1, ratio];
}

// 绘制函数
const draw_canvas=async()=>{
    // 绘制前参数标定
    var ps = await prepare_video_data();
    if(ps==undefined){return};
    console.log('ps', ps);

    var _canvas = document.getElementById('video_canvas');
    if(_canvas==null){return};
    const canvas = document.createElement('canvas');
    canvas.width=_canvas.clientWidth;
    canvas.height=_canvas.clientHeight;

    var ctx = canvas.getContext('2d');
    if(ctx==null){return};

    // 绘制帧
    // console.log('x',x_0.value,'y',y_0.value,'width',image.value.width, 'height', image.value.height);
    
    if(cache.value[g_frame_id.value].data!=undefined){
        ctx.drawImage(cache.value[g_frame_id.value].data, 0, 0, 512, 512, ps[0], ps[1], ps[2], ps[3]);
        // ctx.drawImage(cache.value[now_frame.value].data, 0, 0, 512, 512, 0,0,512,512);
    }
    // // 绘制包围框
    var p = ps;
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
            ctx.strokeRect(p[0]+temp[k]['bbox'][0]/p[4], p[1]+temp[k]['bbox'][1]/p[4], temp[k]['bbox'][2]/p[4], temp[k]['bbox'][3]/p[4]);
            console.log('bbox',p[0]+temp[k]['bbox'][0]/p[4], p[1]+temp[k]['bbox'][1]/p[4], temp[k]['bbox'][2]/p[4], temp[k]['bbox'][3]/p[4]);
        }
        
        // 绘制关键点
        for(let k=0;k<temp.length;k++){
            for(let j=0;j<temp[k]['keypoints'].length;j+=3){
                ctx.fillStyle='#DC7347';
                ctx.beginPath();
                ctx.arc(p[0]+temp[k]['keypoints'][j]/p[4], p[1]+temp[k]['keypoints'][j+1]/p[4], 1, 0, Math.PI * 100); // x, y 是圆心的坐标，1 是半径，0 和 Math.PI * 2 是起始和结束角度，表示一个完整的圆
                ctx.fill(); // 使用当前的填充样式填充圆形
            }
        }
    }

    // 双缓存刷新
    var _ctx = _canvas.getContext('2d');

    // 清空
    _ctx.clearRect(0, 0, _canvas.clientWidth, _canvas.clientHeight);
    _ctx.drawImage(canvas,0,0);
}

onMounted(()=>{
    // 组件初始化
    const seekbar_button = document.getElementById('seekbar_button');
    const zone = document.getElementById('zone');
    seekbar_button?.addEventListener('mousedown', drag_start);
    seekbar_button?.addEventListener('mousemove', drag_process);
    zone?.addEventListener('mousemove', drag_process);
    seekbar_button?.addEventListener('mouseup', drag_end);
    zone?.addEventListener('mouseup', drag_end);
});

</script>

<style scoped>
.vc {
    height: 100%;
    width: 100%;
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