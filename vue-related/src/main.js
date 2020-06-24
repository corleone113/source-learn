import Vue from 'vue'
import App from './App.vue'
import store from './components/vuex_comp/store';
import router from './components/vuerouter_comp/router';

Vue.config.productionTip = false
// Vue.mixin({
//   mounted(){
//     console.log('the vue instance mounted:', this);
//   }
// })
const vm = new Vue({
  store,
  router,
  render: h => h(App),
}).$mount('#app');