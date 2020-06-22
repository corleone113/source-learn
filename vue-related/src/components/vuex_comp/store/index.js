import Vuex,{Store} from 'vuex';
import Vue from 'vue';
import parent1 from './parent1';
import parent2 from './parent2';

Vue.use(Vuex);
export default new Store({
    state: {
        root: true,
        name: 'family',
    },
    modules:{
        parent1,
        parent2,
    }
})