function sleep(ms) {
    console.log("Sleeping for " + ms );
    return new Promise(resolve => setTimeout(resolve, ms));
}

var mqtt = require('mqtt')

async function test(a) {
    var client  = mqtt.connect('mqtt://house')

    await sleep(1000);
    client.publish('/delme' + a, "1")
    await sleep(1000);
    client.publish('/delme' +a, "2")
    await sleep(1000);
    client.publish('/delme' +a, "3")

    await sleep(1000);
    client.end();
}

test('a');
test('b');
console.log("Done???");
