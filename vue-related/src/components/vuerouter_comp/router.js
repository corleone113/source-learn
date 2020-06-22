import VueRouter from 'vue-router';
import Vue from 'vue';
import UseRoute1 from './UseRoute1';
import Parent1 from './ParentRoute1'
import Son1 from './SonRoute1';
import Son2 from './SonRoute2';
import SonDefualt from './SonDefault';

Vue.use(VueRouter);
const router = new VueRouter({
    // mode:'history',
    routes: [{
        path: '/route1/:id?',
        component: UseRoute1,
    }, {
        path: '/redirect/:id',
        redirect: '/route1/:id',
        component: UseRoute1,
    }, {
        path: '/some',
        alias: '/one',
    }, {
        name: 'parent',
        path: '/parent',
        component: Parent1,
        children: [{
                name: 'son1',
                path: 'son1',
                component: Son1,
                alias: '/ps1',
            },
            {
                name: 'son2',
                path: 'son2(.*)',
                component: Son2,
                alias: '/ps2(.*)', // path含有路径参数则alias也要有相同的路径参数
            },
            {
                name: 'default',
                path: '*',
                component: SonDefualt,
            }
        ]
    }],
    scrollBehavior(to, from, ) {
        if (to.path.indexOf('/parent/son2') >= 0) {
            console.log('>>>>> target path:', to.path);
            return {
                selector: '#344',
                offset: {
                    x: 100,
                    y: 100,
                }
            }
        }
    },
})
router.beforeEach((to, from, next) => {
    if (to.path.indexOf('/ban') > -1) {
        console.log('the ban:', to);
        return next(false);
    }
    next();
})

export default router;