<template>
    <div>
        Route1
        <router-view />
    </div>
</template>
<script>
export default {
    mounted(){
        console.log('the matched:', this.$route);
    }
}
</script>