<template>
  <div>
    <state-lis :state="parent1" />
    <state-lis :state="parent2" />
    <state-lis :state="son1" />
    <state-lis :state="son2" />
    <button @click="changeAge(20)">change age</button>
    <p>extra data: {{obj.name}}</p>
  </div>
</template>
<script>
import { mapState, mapMutations } from "vuex";
import Vue from "vue";
const StateLis = {
  props: {
    state: Object
  },
  render() {
    const { state } = this;
    return (
      <ul>
        {Object.keys(state).map(k => (
          <li>
            {k} : {state[k]}
          </li>
        ))}
      </ul>
    );
  }
};
const obj = {
  name: "xiao"
};
// Vue.set(obj, 'name', 'corleone');
const _vm = new Vue({
  data() {
    return {
      obj
    };
  }
});
export default {
  components: {
    StateLis
  },
  computed: {
    ...mapState({
      parent1: ({ parent1 }) => parent1,
      parent2: ({ parent2 }) => parent2,
      son1: ({ parent1: { son1 } }) => son1,
      son2: ({ parent1: { son2 } }) => son2
    })
  },
  methods: {
    ...mapMutations(["changeAge"]) // 这里因为各个模块中都有changeAge mutation，所以调用changAge会变更四个模块的age状态
  },
  beforeCreate() {
    this.obj = _vm.obj;
    setTimeout(() => {
      _vm.obj.name = "corleone xiao"; // this.obj是响应式属性，因为引用的是Vue实例的数据对象
      console.log("the obj.name changed**:", obj);
    }, 2000);
  }
};
</script>