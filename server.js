var express = require('express');
var kurento = require('kurento-client');
var path = require('path');
var rpc = require('json-rpc2');

var User = require('./lib/User');
var UserRegister = require('./lib/UserRegister');

var app = express();
var httpServer = require('http').createServer(app);
httpServer.listen(3000);
var io = require('socket.io').listen(httpServer);
var userRegister = new UserRegister();

var count=0;
var kurentoClient =null;
// var webSocketClient = null;
const ws_uri = 'ws://localhost:8888/kurento';
var queueCandidate = {};
var pipelines = {};
var webRtcEndpoits={};

function getSessionId(){
    count++;
    return count;
}


io.on('connection',function(socket){
    var sessionId = getSessionId();

    socket.on('disconnect',function(){
        console.log('Connection ' + sessionId + ' closed');
        stop(sessionId);
        userRegister.unregister(sessionId);
    });


    socket.on('candidate',function(_message){
        var message = JSON.parse(_message);
        var id = message.userId;
        var user = userRegister.getUserById(id);

        user.sendMessage(message);
    });

    socket.on('message',function(_message){
        // console.log('_message ' +_message);

        // if(error) console.log('message error: ' + error);
        var message = JSON.parse(_message);

        switch(message.id){
            case 'register':
                register(sessionId, message.user, socket);
                break;
            case 'call':
                call(sessionId,message.from,message.to,message.sdpOffer);
                break;
            case 'incommingCallResponse':
                incommingCallResponse(sessionId,message.from, message.sdpOffer,function(error){
                    console.log('error: ' +error);
                });
                break;  
            case 'clientIceCandidate':
                console.log('message.candidate ' + JSON.stringify(message.candidate));
                processCandidate(sessionId, message.candidate);
                break;
            default:
                socket.emit(JSON.stringify({
                    id : 'error',
                    message : 'Invalid message ' + message
                }));
                break;
        }
    });
});

function register(id, name, socket){
    console.log('hihi');
    if(userRegister.getUserById(name)){
        var message = {
            id : 'registerResponse',
            response : 'deny'
        }
        socket.emit('server-message',JSON.stringify(message));
    }else {
        var message = {
            id : 'registerResponse',
            response : 'accept'
        }
        userRegister.register(new User(id, name, socket));

        socket.emit('server-message',JSON.stringify(message));
    }
}

function call(callerId, from,to ,sdpOffer){

    // clearCandidatesQueue(callerId);
    console.log('call');
    var caller = userRegister.getUserById(callerId);
    if(userRegister.getUserByName(to)) {
        var callee = userRegister.getUserByName(to);
        caller.peer = to;
        caller.sdpOffer = sdpOffer;
        callee.peer = from;
     
        var message = {
            id : 'incommingCall',
            from : from,
            to :to
        };

        callee.sendMessage(message);
    }else {

        console.log('wrong ' +to);

        var message = {
            id : 'incommingCall',
            response : 'rejected'
        }
        caller.sendMessage(message);
    }
}


var client = rpc.Client.$create(8088, 'localhost', 'myuser', 'secret123');

function incommingCallResponse(calleeId, from, calleeSdpOffer,callback){
    var caller = userRegister.getUserByName(from);
    var callee = userRegister.getUserById(calleeId);
    callee.sdpOffer = calleeSdpOffer;

    // console.log('caller id ' +caller.sdpOffer);
    // console.log('callee id ' +callee.sdpOffer);


    // clearCandidatesQueue(calleeId);

    // getKurentoClient(function(error, kurentoClient){

    //  WebsocketClient.connectWebsocket(function(err,conn){

        client.call('something',[caller.sdpOffer, callee.sdpOffer,caller.id,callee.id],function(error,sdpAnswer){
            if(error) console.log('something error ' +error);
          
            console.log('callerSdpAnswer ' +JSON.stringify(sdpAnswer));
            // console.log('calleeSdpAnswer ' +calleeSdpAnswer);
            var message = {
                id : 'startCommunicate',
                sdpAnswer : sdpAnswer.calleeSdpAnswer
            }
            callee.sendMessage(message);

            message = {
                id : 'callResponse',
                response : 'accepted',
                sdpAnswer : sdpAnswer.callerSdpAnswer
            }
            
            caller.sendMessage(message);

            console.log('start-communicate');
        });

     
       
    
       

          
    //     getKurentoClient(function(error, kurentoClient){

    //     createMediaPipeline(kurentoClient,function(error,pipeline){
    //         if (error) return callback(error);


    //         createMediaElement(pipeline,function(error,callerWebRtcEndpoit){
    //             if(error){
    //                 callback(error);
    //             }

    //             if(queueCandidate[caller.id]){
    //                 while(queueCandidate[caller.id].length){
    //                     var candidate = queueCandidate[caller.id].shift();
    //                     callerWebRtcEndpoit.addIceCandidate(candidate);
    //                     console.log('state callerWebRtc '  +JSON.stringify(callerWebRtcEndpoit));
    //                 }
    //             }

    //             sendCandidate(callerWebRtcEndpoit,caller);

    //             pipeline.create('WebRtcEndpoint',function(error,calleeWebRtcEndpoint){
    //                 if(error){
    //                     callback(error);
    //                 }


    //                 if(queueCandidate[callee.id]){
    //                     while(queueCandidate[callee.id].length){
    //                         var candidate = queueCandidate[callee.id].shift();
    //                         calleeWebRtcEndpoint.addIceCandidate(candidate);

    //                     }
    //                 }
    //                 sendCandidate(calleeWebRtcEndpoint,callee);

    //                 copyQueueCandidate(callee,calleeWebRtcEndpoint);
                    
    //                 pipelines[caller.id] = pipeline;
    //                 pipelines[caller.id] = pipeline;
    //                 webRtcEndpoits[caller.id] = callerWebRtcEndpoit;
    //                 webRtcEndpoits[callee.id] = calleeWebRtcEndpoint;

    //                 callerWebRtcEndpoit.connect(calleeWebRtcEndpoint,function(error){
    //                     if(error) return callback(error);
    //                     console.log('connect');

    //                     calleeWebRtcEndpoint.connect(callerWebRtcEndpoit,function(error){
    //                         if(error) return callback(error);
    //                     });

        
    //                     pipelines[caller.id] = pipeline;
    //                     pipelines[caller.id] = pipeline;
    //                     webRtcEndpoits[caller.id] = callerWebRtcEndpoit;
    //                     webRtcEndpoits[callee.id] = calleeWebRtcEndpoint;

    //                     generateSdpAnswer(webRtcEndpoits,caller, function(error,callerSdpAnswer){
    //                         if (error) return callback(error);
    //                         console.log('callerSdpAnswer '  +callerSdpAnswer);
    //                         generateSdpAnswer(webRtcEndpoits,callee,function(error,calleeSdpAnswer){
    //                             if(error) return callback(error);
    //                            console.log('calleeSdp Answer ' +calleeSdpAnswer)
                            
    //                             var message = {
    //                                 id : 'startCommunicate',
    //                                 sdpAnswer : calleeSdpAnswer
    //                             }
    //                             callee.sendMessage(message);

    //                             message = {
    //                                 id : 'callResponse',
    //                                 response : 'accepted',
    //                                 sdpAnswer : callerSdpAnswer
    //                             }
                                
    //                             caller.sendMessage(message);

    //                             console.log('start-communicate');

    //                             // callback(null);

    //                         });
    //                     });
    //                 });

    //             });

    //         });
    //     });
    // });        
};

function createMediaPipeline(kurentoClient,callback){

    console.log('create pipeline');
    kurentoClient.create('MediaPipeline',function(error,pipeline){
        if(error) return callback(error);

        return callback(null,pipeline);
    });
}


function createMediaElement(pipeline,callback){
    console.log('create elements');
    pipeline.create('WebRtcEndpoint',function(error,webRtcEndpoit){
        if(error) return callback(error);

        return callback(null,webRtcEndpoit);
    });
}

function sendCandidate(webRtcEndpoint,user){
    webRtcEndpoint.on('OnIceCandidate',function(event){
        console.log('KMS candidate ' + JSON.stringify(event.candidate));

        var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
        console.log('KMS candidate getComplexType' + JSON.stringify(candidate));

        var message = {
            id : 'serverCandidate',
            candidate : candidate
        }
        user.sendMessage(message);
    });
}

function copyQueueCandidate(user, webRtcEndpoit){
    if(queueCandidate[user.id]){
        while(queueCandidate[user.id].length){
            console.log(user.name);
            var candidate = queueCandidate[user.id].shift();
            webRtcEndpoit.addIceCandidate(candidate);
        }
    }
}

function connectElements(webRtcEndpoit1,webRtcEndpoint2,callback){
    webRtcEndpoit1.connect(webRtcEndpoint2,function(error){
        if(error) return callback(error);
        return callback(webRtcEndpoint2);
    });
}

function generateSdpAnswer(webRtcEndpoits,user,callback){
    console.log('generate sdp answer '  +user.sdpOffer);
    webRtcEndpoits[user.id].processOffer(user.sdpOffer,function(error,sdpAnswer){
        if(error) return callback(error);
        return callback(null,sdpAnswer);
    });
    webRtcEndpoits[user.id].gatherCandidates(function(error){
        if(error) return callback(error);
    });
}


function getKurentoClient(callback) {
    if(kurentoClient!=null) {
        callback(null,kurentoClient);
    }else{
        kurento(ws_uri,function(error,_kurenClient){
            if (error){
                console.log('could not find media server');
                return callback(error);
            }else{
                kurentoClient = _kurenClient;
                callback(null,kurentoClient);
            }
        });
    }    
}
//nho chinh o day khi dung api gateway
function processCandidate(id, _candidate){
    // console.log('candidate param' + JSON.stringify(_candidate));
    // var candidate = kurento.getComplexType('IceCandidate')(_candidate);
    // console.log('candidate getComplexType ' +JSON.stringify(candidate));
    // if(pipelines[id] && webRtcEndpoits[id]){

    //     var webRtcEndpoit = webRtcEndpoits[id];
    //     // console.log('before add candidate ' +JSON.stringify(webRtcEndpoit));

    //     webRtcEndpoit.addIceCandidate(candidate);
    //     // console.log('after add candidate ' +JSON.stringify(webRtcEndpoit));

    // }else{
    //     if(!queueCandidate[id]){
    //         queueCandidate[id] = [];
    //     }
    //     console.log('queue candidate' +queueCandidate[id]);
    //     queueCandidate[id].push(candidate);
    // }
    var message = {
        userId: id,
        candidate: _candidate
    };



    // WebsocketClient.connectWebsocket(function(err,conn){
        client.call('candidate',[JSON.stringify(message)],function(error){

        });
    // });
}

function stop(sessionId){
    if(!pipelines[sessionId]){
        return;
    }
    var pipeline = pipelines[sessionId];
    delete pipelines[sessionId];
    pipeline.release();
    var stopperUser = userRegister.getUserById(sessionId);
    var stoppedUser = userRegister.getUserByName(stopperUser.peer);
    stopperUser.peer = null;
    if(stoppedUser){
        stoppedUser.peer = null;
        delete pipelines[stoppedUser.id];
        var message = {
            id: 'stopCommunication',
            message: 'remote user hanged out'
        }
        stoppedUser.sendMessage(message)
    }
    clearCandidatesQueue(sessionId);
}    // clearCandidatesQueue(sessionId);


function clearCandidatesQueue(sessionId) {
    // if (queueCandidate[sessionId]) {
    //     console.log('clear');
    //     delete queueCandidate[sessionId];
    // }
}

app.use(express.static(path.join(__dirname,'static')));
