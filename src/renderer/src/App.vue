<template>
    <el-select v-model="value" placeholder="Select" style="width: 240px" size="small">
        <el-option
            v-for="item in options"
            :key="item.value"
            :label="item.label"
            :value="item.value"
        />
    </el-select>
    <el-button v-if="value=='H5Video'" @click="select_h5video()">select_00</el-button>
    <el-button v-if="value=='ILVideo'" @click="select_ilvideo()">select_01</el-button>
    <el-button @click="select_json()">select_1</el-button>
    <el-button @click="load()">load</el-button>
    <div v-if="type=='H5Video'" style="height: 400px;width: 500px;">
        <H5Video v-if="is_load" :data="g_video_data" />
    </div>
    <div v-if="type=='ILVideo'" style="height: 400px;width: 500px;">
        <ILVideo v-if="is_load" :data="g_video_data" />
    </div>
    
</template>

<script setup lang="ts">
import H5Video from './components/H5Video.vue'
import ILVideo from './components/ILVideo.vue'
import Versions from './components/Versions.vue'

import { ref, onMounted } from 'vue';

const g_video_data = ref();
const is_load = ref(true);

const value = ref("H5Video")
const options = [
    {
        value: 'H5Video',
        label: 'H5Video',
    },
    {
        value: 'ILVideo',
        label: 'ILVideo',
    }
]

onMounted(()=>{
    // g_video_data.value = {
    //     video_url: "E:/Project/Space animal behavior analysis platform/project/project_test_1/raw_video_test_list/A.mp4",
    //     coco_json: "E:/Project/Space animal behavior analysis platform/project/project_test_1/three_stages_model_pose_vitpose_result_2025_11_06T00_01_47/result/A/pose_results_chunk_0000.json"
    // }
})

// 参数选择
const type = ref("");
const h5video_url = ref("");
const ilvideo_url = ref("");
const json_url = ref("");
const select_h5video = async () => {
    h5video_url.value = await handleSelectFile();
}
const select_ilvideo = async () => {
    ilvideo_url.value = await handleSelectDirectory();
}
const select_json = async () => {
    json_url.value = await handleSelectFile();
}

const load=()=>{
    type.value = value.value;
    if(type.value=="H5Video"){
        g_video_data.value = {
            video_url: h5video_url.value,
            coco_json: json_url.value
        }
    }
    else if(type.value=="ILVideo"){
        g_video_data.value = {
            video_url: ilvideo_url.value,
            coco_json: json_url.value
        }
    }
}

// 文件选择器
async function handleSelectFile() {
    try {
        const result = await window['video_api'].openFileDialog({
            properties: ['openFile'],
            filters: [
                
            ]
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            console.log('选择的文件:', result.filePaths[0]);
            return result.filePaths[0];
        }
    } catch (error) {
        console.error('选择文件失败:', error);
    }
}

async function handleSelectDirectory() {
    try {
        const result = await window['video_api'].openDirectoryDialog();

        if (!result.canceled && result.filePaths.length > 0) {
            console.log('选择的目录:', result.filePaths[0]);
            return result.filePaths[0];
        }
    } catch (error) {
        console.error('选择目录失败:', error);
    }
}

</script>