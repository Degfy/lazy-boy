const {
    is,
    toCamel,
    toDownLine,
    unCapitalize,
} = require('rubbi');

const util = require('util');
const debuglog = util.debuglog('dirLoader');
const fs = require('fs');
const path = require('path');
const global_map = new Map;

const isDir = Symbol('isDir');
const dirInstance = Symbol('dirInstance');
const isLoaded = Symbol('isLoaded');


function LazyBoy(dirPath, opts) {
    opts = Object.assign({
        fileSuffix: '.js', //要加载的文件名后缀
        nameTrans: toDownLine,

        diligent: false, // 勤快模式,一次性全部模块加载到内存

        instance: true, // 加载的模块可能是一个类型，如果是类，将其实例化
        proxy: false, //是否代理加载对象的属性

        factory: true, //加载的模块，可能是一个工厂函数
        factoryParams: [], //如果加载的是一个工厂函数，将传递的参数

        capitalize: false, //访问路径大写:`x = new LazyBoy(path, {capitalize:true});x.Example`
        suffix: '', //访问添加的统计后缀:`x = new LazyBoy(path, {suffix:'Service'});x.ExampleService`
        useGlobalCache: false,
    }, opts);

    if (!is.array(opts.factoryParams)) {
        opts.factoryParams = [opts.factoryParams];
    }
    if (!is.function(opts.nameTrans)) {
        opts.nameTrans = toDownLine;
    }

    return function Dir(...args) {
        const __map = opts.useGlobalCache ? global_map : new Map;
        const originObj = this;
        const fileReg = new RegExp(opts.fileSuffix + '$');

        function pre_load(dirPath) {
            if (!originObj[isLoaded]) {
                fs
                    .readdirSync(dirPath)
                    .forEach(file => {
                        if (fileReg.test(file)) {
                            const filePath = path.resolve(dirPath, file);
                            try {
                                require(filePath);
                                originObj[toCamel(file.replace(fileReg, ''))] = filePath;
                            } catch (e) {
                                debuglog('require e:', e);
                            }
                        }
                    });
                originObj[isLoaded] = true;
            }
        }

        if (opts.diligent) {
            pre_load(dirPath);
        }

        return new Proxy(originObj, {
            get(_, name) {
                switch (name) {
                    case util.inspect.custom:
                    case 'inspect':
                    case Symbol.iterator:
                        return;

                    case Symbol.toStringTag:
                        pre_load(dirPath);
                        return 'Dir';
                    case 'constructor':
                        return Dir;
                }

                const _nameKey = dirPath + '$$' + name;
                let _class = __map.get(_nameKey);

                if (!_class) {
                    let _name = name;
                    if (opts.capitalize) {
                        _name = unCapitalize(_name);
                        if (_name === name) {
                            throw Error(name + ' 必须大写字母打头')
                        }
                    }

                    if (opts.suffix && is.string(opts.suffix)) {
                        const reg = new RegExp(opts.suffix + '$');
                        _name = _name.replace(reg, '');
                        if (_name === name) {
                            throw Error(name + ' 后缀必须是' + opts.suffix);
                        }
                    }

                    _name = opts.nameTrans(_name);
                    const _path = path.resolve(dirPath, _name);
                    let filePath = _path;
                    if (opts.fileSuffix) {
                        filePath += opts.fileSuffix;
                    }

                    if (fs.existsSync(filePath)) {
                        let stat = fs.statSync(filePath);
                        if (stat.isFile()) {
                            _class = require(filePath);
                            if (opts.factory && !is.class(_class) && is.function(_class)) {
                                _class = _class(...opts.factoryParams);
                            }
                        } else if (stat.isDirectory) {
                            _class = LazyBoy(filePath, opts);
                            _class[isDir] = true;
                        } else {
                            throw new Error(`${_nameKey} resovle failed, ${_path} is not available`);
                        }
                    } else {
                        if (fs.existsSync(_path)) {
                            const stat = fs.statSync(_path);
                            if (stat.isDirectory) {
                                _class = LazyBoy(_path, opts);
                                _class[isDir] = true;
                            }
                        }
                        if (!_class) {
                            throw new Error(`${_nameKey} resovle failed, ${_path} is not available`);
                        }
                    }
                    __map.set(_nameKey, _class);
                }

                if (_class[isDir]) {
                    if (!originObj[dirInstance]) {
                        originObj[dirInstance] = new _class(...args);
                    }
                    return originObj[dirInstance];
                }

                if (opts.instance && is.function(_class)) {
                    debuglog('instance the class');
                    let obj = new _class(...args);
                    if (opts.proxy) {
                        obj = new Proxy(obj, opts.proxy);
                    }
                    obj.__path = _class.__path;
                    return obj;
                } else {
                    return _class;
                }
            },
        });
    };
}


module.exports = LazyBoy;
