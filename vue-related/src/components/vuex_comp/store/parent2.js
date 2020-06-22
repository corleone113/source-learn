export default {
    namespaced: true,
    state: {
        name: 'parent2',
        age: 28,
        learn: 'front',
    },
    mutations: {
        changeName(state, name) {
            state.name = name;
        },
        changeAge(state, age) {
            state.age = age;
        },
        changeLearn(state, learn) {
            state.learn = learn;
        }
    },
    getters:{
        theMix(state){
            return state.name + state.age;
        }
    }
}