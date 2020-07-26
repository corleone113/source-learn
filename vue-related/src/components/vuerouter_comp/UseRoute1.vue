<template>
    <div>
        Route1
        <!-- <router-view /> -->
        <input type="text" v-model="som">
        <p>{{som}}</p>
    </div>
</template>
<script>
export default {
    data(){
        return {
            som: 'corleone',
        }
    },
    mounted(){
        console.log('the matched:', this.$route);
    }
}
</script>