<template>
  <div id="app">
    <!-- <img alt="Vue logo" src="./assets/logo.png">
    <HelloWorld msg="Welcome to Your Vue.js App"/>-->
    <use-vuex1 />
    <button @click="currentRoute">print route</button>
    <router-link to="/redirect/34544?name=xiao#app" active-class="activeC">go to route1</router-link>
    <br />
    <router-link to="/ps1" active-class="activeC">
      go ps1
      <!-- <template v-slot="{href}">
        <link1 title="go ps11" :href="href" />
        <link1 title="go ps22" :href="href" />
      </template>-->
    </router-link>
    <keep-alive>
      <router-view />
    </keep-alive>
  </div>
</template>

<script>
// import HelloWorld from './components/HelloWorld.vue'
import UseVuex1 from "./components/vuex_comp/UseVuex1";
// import Link1 from "./components/vuerouter_comp/LinkComp";
export default {
  name: "App",
  components: {
    // HelloWorld,
    UseVuex1
    // Link1
  },
  methods: {
    currentRoute() {
      console.log("the route for app:", this.$route, this.$router, this);
    }
  }
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
  height: 1600px;
}
.activeC {
  font-size: 18px;
  color: indianred;
}
</style>
