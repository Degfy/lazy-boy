const {
    is,
    toCamel,
    toDownLine,
    unCapitalize,
} = require('rubbi');

const util = require('util');
const debuglog = util.debuglog('dirLoader');
const is = require('is-type-of');
const fs = require('fs');
const path = require('path');
const __map = new Map;

const isDir = Symbol('isDir');
const dirInstance = Symbol('dirInstance');


function LazyBoy(dirPath, opts) {
    Object.assign({
        fileSubfix: '.js', //要加载的文件名后缀
        nameTrans: toDownLine,

        diligent: false, // 勤快模式,一次性全部模块加载到内存

        instance: false, // 加载的模块可能是一个类型，如果是类，将其实例化
        proxy: false, //是否代理加载对象的属性

        factory: true, //加载的模块，可能是一个工厂函数
        factoryParams: [], //如果加载的是一个工厂函数，将传递的参数

        capitalize: false, //访问路径大写:`x = new LazyBoy(path, {capitalize:true});x.Example`
        subfix: '', //访问添加的统计后缀:`x = new LazyBoy(path, {subfix:'Service'});x.ExampleService`
    }, opts);

    if (!is.array(opts.factoryParams)) {
        opts.factoryParams = [opts.factoryParams];
    }


    return function Dir(...args) {
        const originObj = this;
        const fileReg = new RegExp(opts.fileSubfix + '$');

        if (opts.diligent) {
            function load(dirPath) {
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
            }

            load(dirPath);
        }

        return new Proxy(originObj, {
            get(_, name) {
                switch (name) {
                    case util.inspect.custom:
                    case 'inspect':
                    case Symbol.iterator:
                        return;

                    case Symbol.toStringTag:
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

                    if (opts.subfix && is.string(opts.subfix)) {
                        const reg = new RegExp(opts.subfix + '$');
                        _name = _name.replace(reg, '');
                        if (_name === name) {
                            throw Error(name + ' 后缀必须是' + opts.subfix);
                        }
                    }

                    _name = nameTrans(_name);
                    const _path = path.resolve(dirPath, _name);
                    let filePath = _path;
                    if (opts.fileSubfix) {
                        filePath += opts.fileSubfix;
                    }

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
                        stat = fs.statSync(_path);
                        if (stat.isDirectory) {
                            _class = LazyBoy(_path, opts);
                            _class[isDir] = true;
                        } else {
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
