module.exports = (p1, p2) =>
    class {
        say() {
            return [p1, p2].join(',');
        }
    }
