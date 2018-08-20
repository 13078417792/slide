(function(w) {
    Element.prototype.setCss = function(style) {
        for (let i in style) {
            this.style[i] = style[i];
        }
    }

    function deepClone(target, obj) {
        if (typeof target !== 'object') {
            target = {};
        }
        if (typeof obj !== 'object') {
            obj = {};
        }
        for (var i in obj) {
            if (typeof obj[i] === 'object') {
                target[i] = deepClone(target[i], obj[i]);
            } else {
                target[i] = obj[i];
            }
        }
        return target;
    }

    function empty(val) {
        if (val instanceof Array) {
            return val.length <= 0;
        } else if (typeof val === 'object') {
            for (let i in val) {
                return false;
            }
            return true;
        } else {
            return !val;
        }
    }

    function slide(config) {
        const conf = typeof config === 'object' && !empty(config) ? deepClone(this.base_config, config) : deepClone(this.base_config, {});
        this.config = conf;
        this.init();
        return this;
    }
    slide.prototype = {
        constructor: slide,
        base_config: {
            wrapper: '.slide',
            container: '.container',
            page: '.page',
            next: '.next',
            prev: '.prev',
            duration: 1500,
            toggle: 'click'
        },
        style: {
            container: {
                width: 0,
                whiteSpace: 'nowrap',
                transform: 'translate3d(0,0,0)',
                transition: 'transform .3s',
            },
            containerWrapper: {
                width: '100%',
                overflow: 'hidden'
            },
            slideItem: {
                display: 'inline-block',
                float: 'left'
            },
        },
        elNodeArray: [],
        index: 1,
        container: null,
        container_wrapper: null,
        wrapper: null,
        nextTimeoutIndex: null,
        pageItemElArray: null,
        slideElArray: [],
        timeoutIndex: null,
        screenSize: {
            width: null,
            height: null,
        },
        touch: {
            startX: null,
            moveX: null,
            percent: null,
        },
        getStyle() {
            return this.style;
        },
        config: {},
        init: function() {
            // 根元素
            const wrapper = document.querySelector(this.config.wrapper);
            this.wrapper = wrapper;
            // 容器元素
            const container = document.querySelector(this.config.container);
            this.container = container;
            let item_arr = document.querySelectorAll(this.config.wrapper + ' ' + this.config.container + '>*');
            Array.prototype.slice.call(item_arr).forEach((el, index) => {
                el.setAttribute('index', index); // 为每个轮播元素绑定索引
            });
            if (!container.firstChild && item_arr.length >= 2) {
                return false;
            }
            container.insertBefore(item_arr[item_arr.length - 1].cloneNode(true), item_arr[0]);
            container.appendChild(item_arr[0].cloneNode(true));
            item_arr = document.querySelectorAll(this.config.wrapper + ' ' + this.config.container + '>*');
            // 轮播的元素集合
            item_arr = Array.prototype.slice.call(item_arr);
            this.slideElArray = [].concat(item_arr);
            // 容器宽度
            this.style.container.width = item_arr.length * 100 + '%';
            // 容器子项目宽度
            this.style.slideItem.width = 100 / item_arr.length + '%';
            const slideItemStyle = deepClone({}, this.style.slideItem);
            this.elNodeArray = item_arr;
            item_arr.forEach((el, index) => {
                for (let i in slideItemStyle) {
                    el.style[i] = slideItemStyle[i];
                }
            });
            this.style.slideItem.width = 100 / item_arr.length;
            this.style.container.transform = this.convertTranslate3d((-1 * this.style.slideItem.width) + '%');
            container.setCss(this.style.container);
            // 创建容器包裹层
            let container_wrapper = document.createElement('div');
            this.container_wrapper = container_wrapper;
            container_wrapper.classList.add('container-wrapper');
            // 容器包裹层添加内联样式
            container_wrapper.setCss(this.style.containerWrapper);
            // 容器节点移动到容器包裹层节点下
            container_wrapper.appendChild(container);
            // 容器包裹层节点插入到根节点
            wrapper.appendChild(container_wrapper);
            // 清除浮动
            let clearBoth = this.createClearFloat();
            container.appendChild(clearBoth);
            this.getScreenSize();
            this.setPage();
            this.setCurrentPageOn();
            this.event();
            this.play();
        },
        getScreenSize() {
            this.screenSize.width = document.body.clientWidth;
            this.screenSize.height = document.body.clientHeight;
        },
        createClearFloat() {
            let clearBoth = document.createElement('div');
            const style = {
                clear: 'both',
                display: 'block',
                width: 0,
                height: 0
            };
            clearBoth.setCss(style);
            return clearBoth;
        },
        convertTranslate3d: function(x, y, z) {
            if (!x) {
                x = 0;
            }
            if (!y) {
                y = 0;
            }
            if (!z) {
                z = 0;
            }
            return 'translate3d(' + x + ',' + y + ',' + z + ')';
        },
        event() {
            if (this.elNodeArray.length <= 0) {
                return false;
            }
            const prev = document.querySelector(this.config.prev);
            const next = document.querySelector(this.config.next);
            const wrapper = document.querySelector(this.config.wrapper);
            const container = document.querySelector(this.config.container);
            prev.addEventListener('click', () => {
                this.prev();
            });
            next.addEventListener('click', () => {
                this.next();
            });
            wrapper.addEventListener('mouseenter', () => {
                this.stop();
            });
            wrapper.addEventListener('mouseleave', () => {
                this.play();
            });
            // 移动端触摸事件
            // 拖动开始
            container.addEventListener('touchstart', e => {
                this.stop();
                this.hasAnimate(false);
                this.touch.startX = e.changedTouches[0].clientX;
            }, false);
            // 拖动中
            container.addEventListener('touchmove', e => {
                let x = e.changedTouches[0].clientX,
                    diff = this.touch.startX - x,
                    percent = diff / this.screenSize.width,
                    index = (this.index + percent) || 0;
                this.touch.percent = percent;
                const moveX = this.convertTranslate3d(-1 * this.style.slideItem.width * index + '%');
                this.style.container.transform = moveX;
                this.container.style.transform = this.style.container.transform;
            }, false);
            // 拖动结束
            container.addEventListener('touchend', () => {
                this.hasAnimate();
                if (Math.abs(this.touch.percent) > 0.1) {
                    if (this.touch.percent > 0) {
                        this.next();
                        if (this.index > this.elNodeArray.length - 2) {
                            setTimeout(() => {
                                this.hasAnimate(false);
                                this.index = 1;
                                this.run();
                            }, window.getComputedStyle(container).transitionDuration.replace('s', '') * 1000 + 50);
                        }
                        this.touch.percent = null;
                    } else {
                        this.prev();
                        if (this.index <= 0) {
                            setTimeout(() => {
                                this.hasAnimate(false);
                                this.index = this.elNodeArray.length - 2;
                                this.run();
                            }, window.getComputedStyle(container).transitionDuration.replace('s', '') * 1000 + 50);
                        }
                        this.touch.percent = null;
                    }
                    return false;
                }
                this.run();
            }, false);
        },
        // 是否有过渡效果
        hasAnimate: function(has = true) {
            if (!has) {
                this.style.container.transition = 'unset';
            } else {
                this.style.container.transition = 'transform .3s';
            }
            this.container.style.transition = this.style.container.transition;
        },
        // 执行
        run: function() {
            const x = this.convertTranslate3d((-1 * this.style.slideItem.width * this.index) + '%');
            this.style.container.transform = x;
            this.container.style.transform = this.style.container.transform;
            this.setCurrentPageOn();
            this.stop();
            this.play();
        },
        // 下一张
        next: function() {
            // console.log('next');
            if (this.index < this.elNodeArray.length - 1) {
                this.hasAnimate(true);
                this.index += 1;
            } else {
                this.hasAnimate(false);
                this.index = 1;
                this.run();
                setTimeout(() => {
                    this.hasAnimate();
                    this.index += 1;
                    this.run();
                }, window.getComputedStyle(document.querySelector(this.config.container)).transitionDuration.replace('s', '') * 1000 + 50);
                return false;
            }
            this.run();
        },
        // 上一张
        prev: function() {
            if (this.index <= 0) {
                this.hasAnimate(false);
                this.index = this.elNodeArray.length - 2;
                this.run();
                setTimeout(() => {
                    this.hasAnimate();
                    this.index -= 1;
                    this.run();
                }, window.getComputedStyle(document.querySelector(this.config.container)).transitionDuration.replace('s', '') * 1000 + 50);
                return false;
            } else {
                this.hasAnimate();
                this.index -= 1;
            }
            this.run();
        },
        // 分页
        setPage() {
            const total = this.elNodeArray.length - 2;
            let oldPageEl = document.querySelector(this.config.wrapper + ' ' + this.config.page);
            const pageEl = document.createElement('div');
            pageEl.classList.add(this.config.page.replace(/^[\.#]*/, ''));
            const pageElUl = document.createElement('ul');
            pageEl.appendChild(pageElUl);
            pageElUl.innerHTML = '';
            for (let i = 0; i < total; i++) {
                // console.log(this.elNodeArray[this.index].getAttribute('index'));
                pageElUl.innerHTML += '<li></li>';
            }
            if (oldPageEl) {
                this.wrapper.removeChild(oldPageEl);
            }
            this.wrapper.appendChild(pageEl);
            this.pageToggle();
        },
        pageToggle() {
            const li = document.querySelectorAll(this.config.page + ' li');
            const self = this;
            const toggle = this.config.toggle == 'click' ? 'click' : 'mouseover';
            Array.prototype.slice.call(li).forEach(function(el, index) {
                el.addEventListener(toggle, function() {
                    self.index = index + 1;
                    self.run();
                });
            });
        },
        setCurrentPageOn: function() {
            if (!this.pageItemElArray) {
                const el = document.querySelectorAll(this.config.page + ' li');
                this.pageItemElArray = Array.prototype.slice.call(el);
            }
            if (this.pageItemElArray && this.pageItemElArray instanceof Array && this.pageItemElArray.length > 0) {
                this.pageItemElArray.forEach((el, index) => {
                    if (index === parseInt(this.slideElArray[this.index].getAttribute('index'))) {
                        el.classList.add('on');
                    } else {
                        el.classList.remove('on');
                    }
                });
            }
        },
        stop: function() {
            if (this.timeoutIndex) {
                clearTimeout(this.timeoutIndex);
            }
        }, // 停止运行
        play: function() {
            this.timeoutIndex = setTimeout(() => {
                this.next();
            }, this.config.duration)
        }, // 运行
    }
    w.slide = slide;
})(window);
// $(function(){
//  const ins = new slide({duration:800});
// });