const fs = require('fs');
const os = require('os');
const path = require('path');
const mqtt = require('mqtt')

const child_process = require('child_process');

var AWS = require('aws-sdk');
AWS.config.logger = console;
AWS.config.update({region: 'eu-west-1'});
var cloudWatch = new AWS.CloudWatch();

var mqttClient = mqtt.connect('mqtt://house')

const configFile = path.resolve(__dirname, 'config.'+os.hostname()+'.json');
console.log('Loading ' + configFile)
var localConfig = JSON.parse(fs.readFileSync(configFile,'utf-8'));
console.log(JSON.stringify(localConfig,null,'  '));

function getTemperature(sensor) {
    var filename = '/sys/bus/w1/devices/'+sensor+'/w1_slave'
    console.log('Reading file ' + filename);
    var content = fs.readFileSync(filename,'utf-8');
    console.log('Content : ' + content);
    var r = new RegExp('t=(?<temp>([0-9]*))','g')
    var tempString = r.exec(content)[1];
    var temp = parseFloat(tempString)/1000;
    console.log('Temperature : ' + temp);
    return temp;
}

async function publishMetric(objectName, metricName, value) {
    console.log("Publishing to AWS");
    await cloudWatch.putMetricData({
        MetricData: [{
            MetricName: metricName,
            StorageResolution: "60",
            Value: ""+value,
            Dimensions: [{
                Name:"Object",
                Value:objectName
            }]
        }],
        Namespace: "House"
    }).promise();
    
    console.log("CloudWatch publish complete")

    const mqttChannel = "/sensordump/" + objectName + "/" + metricName;
    console.log("Publishing to MQTT " + mqttChannel);
    mqttClient.publish(mqttChannel, ""+value)
}

async function publishTemperature(sensor, metricName) {
    console.log('Logging sensor ' + sensor + ' as ' + metricName)

    var temperature = getTemperature(sensor);

    console.log("Publishing to CloudWatch");
    await publishMetric(metricName, "Temperature", temperature);
}


function decodeJinouxTempHumidity(input) {
    console.log("Decoding blueinput ["+input+"]");
    /*
    Service 0XAA20. Temp & humid data. There are 6 bytes.
    1. Temperature positive/negative: 0 means positive (+) and 1 means negative (-)
    2. Integer part of temperature. Show in Hexadecimal.
    3. Decimal part of temperature. Show in Hexadecimal.
    4. Reserved byte. Ignore it.
    5. Integer part of humidity. Show in Hexadecimal.
    6. Decimal part of humidity. Show in Hexadecimal.
    For example: 00 14 05 22 32 08 means +20.5C 50.8%
    01 08 09 00 14 05 means -8.9C 20.5%
    */
    var m = new RegExp('value: (?<temp>(.*))\n','g');
    var parts = m.exec(input)[1].split(' ').map( x => parseInt(x,16));
    var ret = {
        temperature : (parts[0]==0?1:-1) * (parts[1]+parts[2]*0.1),
        humidity : (parts[4]+parts[5]*0.1)
    }
    console.log( JSON.stringify( ret));

    return ret;
}


function execShellCommand(cmd) {
    const exec = child_process.exec;
    return new Promise((resolve, reject) => {
     exec(cmd, (error, stdout, stderr) => {
      if (error) {
       console.warn(error);
      }
      var ret = stdout ? stdout : stderr;
      console.log("Returning " + ret);
      resolve(ret);
     });
    });
   }


async function publishJinouxTempHumidity(deviceId, deviceName) {
    console.log('Fetching and publishing : ' + deviceName + ' from device ' + deviceId );

    var command = "gatttool -b "+deviceId+" -u 0000aa21-0000-1000-8000-00805f9b34fb --char-read";
    console.log("Executing command " + command)
    var response = await execShellCommand(command);
    console.log("Output from command : [" + JSON.stringify(response) + "]");
    var ret = decodeJinouxTempHumidity(response);

    await publishMetric(deviceName, "Temperature", ret.temperature);
    await publishMetric(deviceName, "Humidity", ret.humidity);

    return "OK!";
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function publishTemperatures() {
    try {

        if(localConfig.bluetooth) {
            for( var deviceName of Object.keys( localConfig.bluetooth)) {
                var deviceId = localConfig.bluetooth[deviceName].id;
                await publishJinouxTempHumidity(deviceId, deviceName);
            }
        }
        
        if(localConfig.sensorMap) {
            for( var sensorName of Object.keys(localConfig.sensorMap) ) {
                var sensorId = localConfig.sensorMap[sensorName].id;
                await publishTemperature(sensorId, sensorName);
            }
        }

    } catch( e ) {
        console.log("Error!!!! " + e);
    } finally {
        console.log("Sleeping for 60 seconds")
        await sleep(60*1000);
    }
}

async function publishSensorConfig( sensor_id, sensorName, unitForMQTT, unitForHomeAssistant) {

    var payload = {
        device_class: unitForMQTT.toLowerCase(),
        name: sensorName + " " + unitForMQTT,
        state_topic: "/sensordump/"+sensorName+"/" + unitForMQTT,
        unit_of_measurement: unitForHomeAssistant,
        device: {
            identifiers: [
                sensor_id
            ],
            manufacturer: "NA",
            model: "NA",
            name: sensorName
          }
    };
    
    var payloadText = JSON.stringify(payload);
    var channel = "homeassistant/sensor/"+sensorName + "_" + unitForMQTT+"/config";
    console.log("Broadacast ", {channel, payloadText});
    mqttClient.publish( channel, payloadText, {retain:true});
}

async function publishHomeAssistantDiscoveryConfig() {
    console.log("Publishing discovery config")

    if(localConfig.bluetooth) {
        for( var deviceName of Object.keys( localConfig.bluetooth)) {
            var deviceId = localConfig.bluetooth[deviceName].id;
            await publishSensorConfig( deviceId, deviceName,"Temperature","°C");
            await publishSensorConfig( deviceId, deviceName,"Humidity","%");
        }
    }
    
    if(localConfig.sensorMap) {
        for( var sensorName of Object.keys(localConfig.sensorMap) ) {
            var sensorId = localConfig.sensorMap[sensorName].id;
            await publishSensorConfig( sensorId, sensorName, "Temperature","°C");
        }
    }

}


async function AsyncMain() {
    console.log("Sleeping while we are connecting")
    await sleep(1000);

    await publishHomeAssistantDiscoveryConfig();
    while(true) {
        await publishTemperatures();
    }

}


AsyncMain();

console.log("Done!");
