const assert = require('assert');
const LazyBoy = require('..');
const path = require('path');

describe('index.js', () => {
    it('1.测试默认配置时文件加载', () => {
        const Boy = LazyBoy(path.resolve(__dirname, '../test_src/controller'));

        const insParams = ['p1', 'p2'];
        const controller = new Boy(...insParams);

        let words = controller.people.say();
        assert.equal(words, 'People,p1,p2');
        assert.equal(controller.beautifulGirl.say(), 'beautifulGirl');
    });

    it('2.类加载器', () => {
        const Boy = LazyBoy(path.resolve(__dirname, '../test_src/controller'), {
            instance: false,
            capitalize: true,
        });

        const controller = new Boy();
        const people = new controller.People('p1', 'p2');
        assert.equal(people.say(), 'People,p1,p2');

        const beautifulGirl = new controller.BeautifulGirl();
        assert.equal(beautifulGirl.say(), 'beautifulGirl');

        const friend = new controller.Dir.Friend();
        assert.equal(friend.say(), ',');

        const Boy2 = LazyBoy(path.resolve(__dirname, '../test_src/controller'), {
            instance: false,
            suffix: 'Controller',
            capitalize: true,
        });

        const controller2 = new Boy2();

        const friend2 = new controller2.Dir.FriendController();
        assert.equal(friend2.say(), ',');
    });
});
