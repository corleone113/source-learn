export default {
    state:{
        name: 'son11',
        age: 11,
    },
    mutations: {
        changeName(state, name){
            state.name = name;
        },
        changeAge(state, age){
            state.age = age;
        }
    },
    getters:{
        theSonMix(state){
            return state.name + state.age;
        }
    }
}