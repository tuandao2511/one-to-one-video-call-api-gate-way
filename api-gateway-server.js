var rpc = require('json-rpc2');
var rpcBuilder = require('kurento-jsonrpc');

var socket = require('socket.io-client')('http://localhost:3000');

var JsonRpcClient = rpcBuilder.clients.JsonRpcClient;
var ws_uri = "ws://localhost:8888/kurento";

var callerId= 0;
var calleeId= 0;

var server = rpc.Server.$create({
    websocket: true
});


function connectCallback(){
    connected = true;
  }
  
function disconnectCallback(){
    connected = false;
}
  
function errorCallback(error) {
    console.error(error);
}

function onEvent(_message) {
    var candidate = _message.value.data.candidate;
    var message = null;
    // console.log('onEvent ' +_message);
    if(_message.object === webRtcEndpoint[callerId]){
        message = {id:'serverCandidate',userId: callerId,candidate : candidate};
    }    
    else {
        message = {id:'serverCandidate',userId: calleeId,candidate: candidate};
    }    

     
    socket.emit('candidate',JSON.stringify(message));
}


var configuration = {
    sendCloseMessage : false,
    ws : {
      uri : ws_uri,
      useSockJS: false,
      onconnected : connectCallback,
      ondisconnect : disconnectCallback,
      onreconnecting : disconnectCallback,
      onreconnected : connectCallback,
      onerror : errorCallback
    },
    rpc : {
      requestTimeout : 15000,
      onEvent : onEvent
    }
};

var JsonRpcClient = new JsonRpcClient(configuration);

var method = 'create';
var params = {
    type : 'MediaPipeline',
    constructorParams : {},
    properties : {}    
};
var pipeline = null;
var sessionId = null;
var callerWebRtcEndpoint = null;
var calleeWebRtcEndpoint = null;
var webRtcEndpoint = {};
var queueCandidate = {};
var callerSdpAnswer = null;
var calleeSdpAnswer = null;


// socket.on('client-candidate',function(_message){
    // console.log('client-candidate ' +_message);
    // var message = JSON.parse(_message);
    // var id = message.userId;
    // if(webRtcEndpoint[id] && pipeline){

    // }else{
    //     if(!queueCandidate[id]) queueCandidate[id] = [];
    //     console.log('queue candidate ' +queueCandidate[id]);
    //     queueCandidate[id].push(message.candidate);
    // }
// });

server.expose('candidate',function(args,opt,callback){
    // console.log('client-candidate ' +args[0]);
    var message = JSON.parse(args[0]);
    var id = message.userId;
    // console.log('object candidate '+message.candidate);
    if(webRtcEndpoint[id] && pipeline){
        var params = {
            object : webRtcEndpoint[id],
            operation : 'addIceCandidate',
            operationParams:{
                candidate : message.candidate
            },
            sessionId :sessionId
        };
        JsonRpcClient.send('invoke',params,function(error,response){
            console.log('add candidate ?????????????? ' +JSON.stringify(response));
        });
    }else{
        if(!queueCandidate[id]) queueCandidate[id] = [];
        // console.log('queue candidate ' +queueCandidate[id]);
        queueCandidate[id].push(message.candidate);
    }
    callback(null);
});




server.expose('something', function(args,opt,callback) {
    
    var callerSdpOffer = args[0];
    var calleeSdpOffer = args[1];
    callerId = args[2];
    calleeId = args[3];
    // var caller = userRegister.getUserById(callerId);
    // var callee = userRegister.getUserById(calleeId);
    //create media pipeline 
    JsonRpcClient.send('create',params,function(error,_pipeline) {
        if(error) return callback(error);
        console.log('Media pipeline ' + JSON.stringify(_pipeline));

        pipeline = _pipeline.value;
        sessionId = _pipeline.sessionId;


        //create caller webrtc endpoint
        var params = {
            type: "WebRtcEndpoint",
            constructorParams: {
                mediaPipeline : pipeline
            },
            properties : {},    
            sessionId : sessionId
        };

        JsonRpcClient.send('create',params,function(error,_callerWebRtcEndpoint){
            if(error) return callback(error);
    
            console.log('webRtcEndpoint ' + JSON.stringify(_callerWebRtcEndpoint));
            callerWebRtcEndpoint = _callerWebRtcEndpoint.value;


              //add candidate
              if(queueCandidate[callerId]){
                console.log('can candidate');
                while(queueCandidate[callerId].length){
                    var candidate = queueCandidate[callerId].shift();
                    console.log('candidate shift ' +candidate);
                    var params = {
                        object : callerWebRtcEndpoint,
                        operation : 'addIceCandidate',
                        operationParams:{
                            candidate : candidate
                        },
                        sessionId :sessionId
                    };
                    JsonRpcClient.send('invoke',params,function(error,response){
                        console.log('add candidate ?????????????? ' +JSON.stringify(response));
                    });
                }
            }

            //OnIceCandidate
            var params = {
                type : 'OnIceCandidate',
                object: callerWebRtcEndpoint,
                sessionId : sessionId
            };
            JsonRpcClient.send('subscribe', params,function(error,response){
                console.log('caller is subsribed ', +response);
            });
            
            //create callee webrtc endpoint
            var params = {
                type: "WebRtcEndpoint",
                constructorParams: {
                    mediaPipeline : pipeline
                },
                properties : {},    
                sessionId : sessionId
            };

            JsonRpcClient.send('create',params,function(error,_calleeWebRtcEndpoint){
                if(error) return callback(error);

                calleeWebRtcEndpoint = _calleeWebRtcEndpoint.value;
                console.log('webRtcEndpoint callee' + JSON.stringify(_calleeWebRtcEndpoint));

                //add candidate
                if(queueCandidate[calleeId]){
                  console.log('can candidate');
                  while(queueCandidate[calleeId].length){
                      var candidate = queueCandidate[calleeId].shift();
                      console.log('candidate shift ' +candidate);
                      var params = {
                          object : calleeWebRtcEndpoint,
                          operation : 'addIceCandidate',
                          operationParams:{
                              candidate : candidate
                          },
                          sessionId :sessionId
                      };
                      JsonRpcClient.send('invoke',params,function(error,response){
                          console.log('add candidate ?????????????? ' +JSON.stringify(response));
                      });
                  }
                }

                //OnIceCandidate
                var params = {
                    type : 'OnIceCandidate',
                    object: calleeWebRtcEndpoint,
                    sessionId : sessionId
                };
                JsonRpcClient.send('subscribe', params,function(error,response){
                    console.log('callee is subscribed ' +response);
                });

                //assign webrtc endpoint
                webRtcEndpoint[callerId] = callerWebRtcEndpoint;
                webRtcEndpoint[calleeId] = calleeWebRtcEndpoint;

                //connect caller to callee
                var params = {
                    object : callerWebRtcEndpoint,
                    operation : 'connect',
                    operationParams:{
                        sink : calleeWebRtcEndpoint
                    },
                    sessionId : sessionId
                };

                JsonRpcClient.send('invoke', params, function(error,response){
                    if(error) return callback(error);
                    console.log('connect ' +JSON.stringify(response));
                    
                    //connect callee to caller
                    var params = {
                        object : calleeWebRtcEndpoint,
                        operation : 'connect',
                        operationParams:{
                            sink : callerWebRtcEndpoint
                        },
                        sessionId :sessionId
                    };

                    JsonRpcClient.send('invoke', params, function(error,response){
                        if(error) return callback(error);
                        console.log('connect ' +JSON.stringify(response));


                        //generate caller sdpAnswer

                        var params = {
                            object : callerWebRtcEndpoint,
                            operation : 'processOffer',
                            operationParams:{
                                offer :callerSdpOffer
                            },
                            sessionId :sessionId
                        };

                        JsonRpcClient.send('invoke', params, function(error,_callerSdpAnswer){
                            if(error) return callback(error);

                            callerSdpAnswer =_callerSdpAnswer.value;
                            console.log('caller sdp answer ' + JSON.stringify(callerSdpAnswer));

                            //generate callee sdpAnswer

                            var params = {
                                object : calleeWebRtcEndpoint,
                                operation : 'processOffer',
                                operationParams:{
                                    offer : calleeSdpOffer
                                },
                                sessionId :sessionId
                            };

                            JsonRpcClient.send('invoke', params, function(error, _calleeSdpAnswer){
                                if(error) return callback(error);

                                calleeSdpAnswer = _calleeSdpAnswer.value;
                                console.log('callee sdp answer ' + JSON.stringify(calleeSdpAnswer));


                                var obj = {
                                    callerSdpAnswer :callerSdpAnswer,
                                    calleeSdpAnswer : calleeSdpAnswer
                                }

                                console.log('sdp answer ' + JSON.stringify(obj));
                                callback(null,obj);
                            });

                            //callee gathers candidates

                            var params = {
                                object : calleeWebRtcEndpoint,
                                operation : 'gatherCandidates',
                                operationParams:{
                                    offer : calleeSdpOffer
                                },
                                sessionId :sessionId
                            };

                            JsonRpcClient.send('invoke',params,function(error,response){
                                if(error) console.log('gather candidate error callee ' +error);
                                console.log('gather candidates response callee '+JSON.stringify(response));
                            });

                        });

                        //caller gathers candidates

                        var params = {
                            object : callerWebRtcEndpoint,
                            operation : 'gatherCandidates',
                            operationParams:{
                                offer : callerSdpOffer
                            },
                            sessionId :sessionId
                        };

                        JsonRpcClient.send('invoke',params,function(error,response){
                            if(error) console.log('gathercandidate error caller ' +error);
                            console.log('gather candidates response caller '+JSON.stringify(response));
                        });
                       


                    });


                });


            });
        

        });

    });          
});





function createMediaPipeline(params, callback){
    JsonRpcClient.send('create',params,function(error,pipeline) {
        if(error) return callback(error);
        console.log('Media pipeline ' + JSON.stringify(pipeline));
        return callback(null,pipeline);
    });
}

function createMediaElement(params,callback){
    JsonRpcClient.send('create',params,function(error,callerWebRtcEndpoint){
        if(error) return callback(error);

        console.log('webRtcEndpoint ' + JSON.stringify(callerWebRtcEndpoint));
        return callback(null,callerWebRtcEndpoint);

    });
}


server.enableAuth(function(user, password){
    return user === 'myuser' && password === 'secret123';
  });
  
  /* HTTP/Websocket server on port 8088 */
server.listen(8088, 'localhost');

