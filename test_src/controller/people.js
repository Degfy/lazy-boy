class People {
    constructor(...arg) {
        this.arg = arg;
    }
    say() {
        return ['People', ...this.arg].join(',');
    }
}


module.exports = People;
