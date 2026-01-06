<template>
    <div style="height: 400px;width: 500px;">
        <H5Video v-if="is_load" :data="g_video_data" />
    </div>
    
</template>

<script setup lang="ts">
import H5Video from './components/H5Video.vue'
import Versions from './components/Versions.vue'

import { ref, onMounted } from 'vue';

const g_video_data = ref();
const is_load = ref(true);

onMounted(()=>{
    g_video_data.value = {
        video_url: "E:/Project/Space animal behavior analysis platform/project/project_test_1/raw_video_test_list/A.mp4",
        coco_json: "E:/Project/Space animal behavior analysis platform/project/project_test_1/three_stages_model_pose_vitpose_result_2025_11_06T00_01_47/result/A/pose_results_chunk_0000.json"
    }
})

</script>