## Introduction

Super simple node script that will periodially:
- Fetch data from sensors near the PI
- Publish that data over a WiFi connection

### Possible use cases:
- Monitoring temperature in the house over time.
- CloudWatch Alarm when a fish tank temperature is out of range
- Open/Close a window based on temperature / humidity of bathroom

### Supported Sensors:
- [DS18B20 1-Wire Thermometer](https://www.amazon.co.uk/AZDelivery-Temperature-Waterproof-Stainless-Raspberry/dp/B075FYYLLV/ref=sr_1_8?dchild=1&keywords=ds18b20&qid=1610268596&sr=8-8)
- [JINOU Low Energy Temperature and humidity sensor](https://www.amazon.co.uk/gp/product/B07FM4PSGB/ref=ppx_yo_dt_b_search_asin_title?ie=UTF8&psc=1)

### Supported Metrics platforms:
- [AWS CloudWatch](https://aws.amazon.com/cloudwatch/)
- [MQTT publication for Home Assistant](https://www.home-assistant.io/integrations/mqtt/)

## Basic installation
A Raspberry PI is a full blown computer.  You can easily checkout and edit all the files directly on the box.

This package is written using node 10.  It's very simple and probably any later version will work.
If you don't know what you're doing with node installations (I don't really) you can just run:

```sudo apt-get install nodejs npm```

If you're using a remote laptop to configure the PI, [Visual Studio Code](https://code.visualstudio.com/download) and the [Remote SSH extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh-edit) are recommended.



If you are using this script, find your hostnae (for example *pi3*), then copy the config.example.json file to config.*hostname*.json, for example config.pi3.json.  This will get picked up by the host on startup and the convention makes configuring multiple small boxes a little simpler.

If you want to install this to run on boot, it helps to register it with systemctl.  Use the script in install/install.sh to do this.  If you want to install or update this remotely on a number of devices (on a host that already hase node installed) then consider using the install/install-remote.sh script.

## 1 Wire Thermometer Setup (optional)

First up, get your 1 wire thermometer talking to your Raspberry PI.
Your shopping list will probably include something like:

- [DS18B20 1-Wire Thermometer](https://www.amazon.co.uk/AZDelivery-Temperature-Waterproof-Stainless-Raspberry/dp/B075FYYLLV/ref=sr_1_8?dchild=1&keywords=ds18b20&qid=1610268596&sr=8-8)

There are lots of instructions available but [here](https://tutorials-raspberrypi.com/raspberry-pi-temperature-sensor-1wire-ds18b20/) and [here](https://learn.adafruit.com/adafruits-raspberry-pi-lesson-11-ds18b20-temperature-sensing/hardware) are good places to start.

Each sensor has a unqiue ID and when they're setup you'll see a list of them in /sys/bus/w1/devices
```
pi@pi3:~ $ ls /sys/bus/w1/devices
28-011447e2d1aa  28-0517600602ff  w1_bus_master1
```

You can then copy data from the remote device using cat, which will report back the temperature as an integer in 1000ths of degrees:
```
pi@pi3:~ $ cat /sys/bus/w1/devices/28-011447e2d1aa/w1_slave
ff 00 4b 46 7f ff 0c 10 15 : crc=15 YES
ff 00 4b 46 7f ff 0c 10 15 t=15937
```
The Raspberry PI in my kitchen has two 1 Wire sensors connected, one measuring ambient temperature, and one in the fish tank.  The host is called 'pi3' and the config.json is as follows

```json
{
    "sensorMap": {
        "Kitchen": {
            "id": "28-011447e2d1aa"
        },
        "FishTank": {
            "id": "28-0517600602ff"
        }
    }
}
```

## Temperature and Humidity Sensor Config (optional)

For ~20 GBP, you can buy a very workable [low energy JINOU bluetooth sensor](https://www.amazon.co.uk/gp/product/B07FM4PSGB/ref=ppx_yo_dt_b_search_asin_title?ie=UTF8&psc=1).  They will work for over 6 months on a single [CR2302 battery](https://www.amazon.co.uk/cr2302/s?k=cr2302)

There are lots of guides on enabling bluetooth on the PI.  Do that!  The pi0w is a good choice of device rfel

Check your Bluetooth configuration with ```sudo hciconfig```

Scan for Bluetooth devices by running ```sudo hcitool lescan```.  The sensor in the bathroom appeared as 
```
ED:01:5E:CF:2E:77 Jinou_Sensor_HumiTemp
```

You can directly pull the relevant attribute directly from the device with:
```
pi@pi0w:~ $ gatttool -b ED:01:5E:CF:2E:77 -u 0000aa21-0000-1000-8000-00805f9b34fb --char-read
handle: 0x0023   value: 00 16 08 00 30 09
```

The data structure is defined as follows:
```
    Service 0XAA20. Temp & humid data. There are 6 bytes.
    1. Temperature positive/negative: 0 means positive (+) and 1 means negative (-)
    2. Integer part of temperature. Show in Hexadecimal.
    3. Decimal part of temperature. Show in Hexadecimal.
    4. Reserved byte. Ignore it.
    5. Integer part of humidity. Show in Hexadecimal.
    6. Decimal part of humidity. Show in Hexadecimal.
    For example: 00 14 05 22 32 08 means +20.5C 50.8%
    01 08 09 00 14 05 means -8.9C 20.5%
```

This is all our node script does.  To configure the pi0w host for this bluetooth sensor, I have a config.p0w.json file as follows:
```
{
    "bluetooth": {
        "Bathroom" : {
            "id":  "ED:01:5E:CF:2E:77"
        }
    }
}
```

## Publishing to AWS CloudWatch

If you don't want to do this, you'll have to comment out the call in the publishMetric function.

If you do want to do this, you'll need some credentials in ~/.aws .  These should have the minimum possible credentials to publish to CloudWatch.

The AWS CLI tool is not required, but may be useful to verify your user something like this:

```
pi@pi3:~ $ aws sts get-caller-identity
{
    "UserId": "AIDA2134RUBBISH1234MADEUPSTUFF",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/pi"
}
```


I would recommend you setup a specific PI user and providew just these credentials and also consider how you will manage key rotation:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": "cloudwatch:PutMetricData",
            "Resource": "*"
        }
    ]
}
```

The script will publish metrics in eu-west-1 region.  You can update that by changing this line:
  AWS.config.update({region: 'eu-west-1'});

Publishing to Cloud Watch lets you easily setup monitors and dashboards.  Example alarms might be:
- Fish tank temperature is less than 20C for 1 hour
- No data received from fish tank sensor
- Bathroom humidity over 80% for 6 consecutive 10 minute samples
  

## Publishing to MQTT (and hence Home Assistant)

If you don't want to do this, you'll have to comment out the call in the publishMetric function.

If you do want to do this, you'll need to have a working MQTT server.  I would recommend installing mosquito_mqtt on some central server.  This script assumes it can connect to mosquitto on a host called 'house' at ```mqtt://house``` with no authentication.  Ideally we would be using client certificates.

If necessary, install MQTT on a host so the following line can connect to MQTT
```javascript
  var mqttClient = mqtt.connect('mqtt://house')
```
Install client tools with :
```
sudo apt-get install mosquitto-clients
```

To see what's going on, subscribe to messages with this command:
```
mosquitto_sub -h house -v -t \#
...
/sensordump/Kitchen/Temperature 16.125
/sensordump/Bathroom/Temperature 23
/sensordump/FishTank/Temperature 22.562
/sensordump/Bathroom/Humidity 47.2
```

You can also publish test messages with this command:
```
mosquitto_pub -h house -t some/topic -m "This is a test"
```

Along side the vlaues, the script also publishes configuration data for [Home Assistant MQTT Discovery](https://www.home-assistant.io/docs/mqtt/discovery/), so new devices connected to the same MQTT bus should be automatically discovered.  For example:
```
homeassistant/sensor/Kitchen_Temperature/config {"device_class":"temperature","name":"Kitchen Temperature","state_topic":"/sensordump/Kitchen/Temperature","unit_of_measurement":"°C","device":{"identifiers":["28-011447e2d1aa"],"manufacturer":"NA","model":"NA","name":"Kitchen"}}
```




## Random other notes:

### Turning the service on and off for a given host
ssh pi@pi3 systemctl status homer-node
ssh pi@pi3 systemctl status homer-node
ssh pi@pi3 systemctl restart homer-node
