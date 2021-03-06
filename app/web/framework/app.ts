import Vue from 'vue';
import { sync } from 'vuex-router-sync';
import VConsole from 'vconsole';
import axios from '../../lib/axios';
import mixin from './mixin';
import directives from './directives';

export default class App {
    config: any;
    constructor(config) {
        this.config = config;
    }

    bootstrap() {
        if (EASY_ENV_IS_NODE) {
            return this.server();
        }
        return this.client();
    }

    create(initState) {
        const { entry, createStore, createRouter } = this.config;
        const store = createStore(initState);
        const router = createRouter(initState);
        sync(store, router);
        return {
            router,
            store,
            directives,
            render: h => {
                // not use ...entry, why ?
                return h(entry);
            }
        };
    }

    fetch(vm): Promise<any> {
        const { store, router } = vm;
        const matchedComponents = router.getMatchedComponents();
        if (!matchedComponents) {
            return Promise.reject('No Match Component');
        }
        return Promise.all(
            matchedComponents.map((component: any) => {
                const options = component.options;
                if (options && options.methods && options.methods.fetchApi) {
                    return options.methods.fetchApi.call(component, { store, router, route: router.currentRoute });
                }
                return null;
            })
        );
    }

    client() {
        const vConsole = new VConsole();
        
        const state = window.__INITIAL_STATE__ || {};
        axios.baseURL = '';
        // ajax请求
        // 当有指定部署目录时，就用部署目录来当baseURL
        if(state.prefix) {
            axios.baseURL = `/${state.prefix}/`;
        }

        Vue.prototype.$ajax = axios;

        Vue.mixin(mixin); // 混入
        const vm = this.create(state);
        vm.router.afterEach(() => {
            this.fetch(vm);
        });
        const app = new Vue(vm);
        app.$mount('#app');
        return app;
    }

    server() {
        return context => {
            const vm = this.create(context.state);
            const { store, router } = vm;
            router.push(context.state.url);
            return new Promise((resolve, reject) => {
                router.onReady(() => {
                    this.fetch(vm).then(() => {
                        context.state = store.state;
                        return resolve(new Vue(vm));
                    });
                });
            });
        };
    }
}
