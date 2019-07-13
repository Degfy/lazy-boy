module.exports = (p1, p2) =>
    class {
        asy() {
            return [p1, p2].join(',');
        }
    }
