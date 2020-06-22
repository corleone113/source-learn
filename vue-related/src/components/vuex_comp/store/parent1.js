import son1 from './son11';
import son2 from './son22';

export default {
    modules: {
        son1,
        son2,
    },
    state: {
        name: 'parent1',
        age: 25,
    },
    mutations: {
        changeName(state, name) {
            state.name = name;
        },
        changeAge(state, age) {
            state.age = age;
        }
    },
    getters:{
        theMix(state){
            return state.name + state.age;
        }
    }
}