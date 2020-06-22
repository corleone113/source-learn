<template>
    <div>
        {{title}}
        <span> the href: {{href}}</span>
    </div>
</template>
<script>
export default {
    props: ['title', 'href']
}
</script>