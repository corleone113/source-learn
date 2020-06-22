export default {
    state:{
        name: 'son22',
        age: 9,
    },
    mutations: {
        changeName(state, name){
            state.name = name;
        },
        changeAge(state, age){
            state.age = age;
        }
    }
}