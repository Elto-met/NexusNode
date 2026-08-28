//Required nodejs packages
import https from 'node:https'
import http from 'node:http'
import fs from 'node:fs'

const debug = {
    //Create a log  file in the debug directory
    log: function(data, severity){
        //Get the time of error
        let logTime = new Date().toISOString()

        try{
            //Write data to the latest log
            fs.writeFileSync(`${server.hostOptions.rootDirectory}/serverResources/debug/logs/latest.log`, `TIME OF LOG: ${logTime} \nSEVERITY: ${severity} \n${data}`)

            //Write data to a seperate log
            fs.writeFileSync(`${server.hostOptions.rootDirectory}/serverResources/debug/logs/${logTime}.log`, `TIME OF LOG: ${logTime} \nSEVERITY: ${severity} \n${data}`)

            console.log(`Created log with severity: ${severity} at ${server.hostOptions.rootDirectory}/serverResources/debug/logs/${logTime}`)
        }catch(error){
            console.error(error)
        }
    }
}

const server = {
    hostOptions: {
        //Path to the directory the server files are stored in
        rootDirectory: `.`,
        
        //Default port and ip to liten on
        port: 3000,
        host: `0.0.0.0`
    },

    ssl: {
        key: null,
        cert: null
    },

    requests: {
        //Fallback to a directory if a subdomain is not specified; can be changed by "server.requests.defaultSubDomain = `subdomain`".
        defaultSubDomain: `www`,

        //Load 404 page into memory for quicker access.
        pageNotFoundData: null,

        load404Page: function(){
            try{
                server.requests.pageNotFoundData = fs.readFileSync(`${server.hostOptions.rootDirectory}/serverResources/pageNotFound/index.html`)
            }catch(error){
                debug.log(`Error finding 404 page: ${error}`, "ERROR")
            }
        },

        //MIME data; used for sending proper content type to the client.
        MIMETypes: null,

        //Import the MIME types from a json file.
        importMimeTypes: function(){
            try{
                this.MIMETypes = JSON.parse(fs.readFileSync(`${server.hostOptions.rootDirectory}/serverResources/mimeData/mimeTypes.json`)).mimeData
            }catch(error){
                debug.log(`Error parsing MIME data file; please make sure mimeTypes.json is in the directory '${server.hostOptions.rootDirectory}/serverResources/mimeData/'. \n${error}`, "ERROR")
                process.exit(1)
            }
        },

        //Default listener function; can be overwritten by "server.requests.listener = fuction(request, response){listenerCode}".
        listener: function(request, response){
            if(request.method == `GET`){
                server.requests.get(request, response)
            }else if(request.method == `POST`){
                server.requests.post(request, response)
            }else{
                debug.log(`Invalid request method presented: ${request.method}`)
            }
        },

        //GET request handler function; can be overwritten by "server.requests.get = function(request, response){getRequestCode}".
        get: function(request, response){
            //Get the URL from the request.
            let urlParts = request.headers.host.split(".")

            //Initialize requested filepath and MIME type.
            let filepath
            let MIMEType

            //Start filepath with the subdomain of the URL of the request, or return back to the default subdomain.
            if(urlParts.length >= 3){
                filepath = `${server.hostOptions.rootDirectory}/${urlParts[0]}`
            }else{
                filepath = `${server.hostOptions.rootDirectory}/${server.requests.defaultSubDomain}`
            }

            //Handle root directory page. i.e: 'https://www.domain.com/'
            if(request.url == "/"){
                filepath += "/index.html"
                MIMEType = "text/html"
            }else{
                //Handle requests with the full file path. i.e: 'https://www.domain.com/file.extension'
                if(request.url.includes(".")){
                    try{
                        filepath += `/${request.url}`

                        //Get the requested file's file extension.
                        let fileExtension = request.url.split(".")[1]

                        //Find MIME type with corresponding file extension.
                        let rawMimeType = server.requests.MIMETypes.find(mimes => mimes.extensions.includes(fileExtension))
                        
                        //Set MIME type variable from the found MIME type
                        MIMEType = rawMimeType.mime
                    }catch(error){
                        debug.log(`${error}`, "ERROR")
                    }
                }
                //Handle requests with no direct file path. i.e: 'https://www.domain.com/folder/'
                else{
                    filepath += `/${request.url}/index.html`
                    MIMEType = "text/html"
                }
            }

            //Handle non-existent requested file.
            if(!fs.existsSync(filepath)){
                server.requests.pageNotFound(request, response)
            }else{
                //Create a file stream to stream data to the client.
                let fileStream = fs.createReadStream(filepath)

                //Send Headers to the client.
                response.writeHead(200, {'Content-Type': MIMEType, 'X-Content-Type-Options': 'nosniff'})

                fileStream.pipe(response)

                fileStream.on('error', (error) => {
                    debug.log(`Error reading file stream: ${error}`)
                    response.end()
                })
            }
        },

        //POST request handler function; can be overwritten by "server.requests.post = function(request, response){postRequestCode}".
        post: function(request, response){
            response.writeHead(200)
            response.end()
        },

        //Default response when the server cannot locate a file; can be overwritten by "server.requests.pageNotFound = function(request, response){pageNotFoundCode}"".
        pageNotFound: function(request, response){
            //Send created 404 page if it can be found.
            if(server.requests.pageNotFoundData != null){
                response.writeHead(404)
                response.write(server.requests.pageNotFoundData)
                response.end()
            }else{
                response.writeHead(404)
                response.end()
            }
        }
    },

    start: function(){
        try{
            server.ssl.key = fs.readFileSync(`${server.hostOptions.rootDirectory}/serverResources/ssl/key.pem`)
            server.ssl.cert = fs.readFileSync(`${server.hostOptions.rootDirectory}/serverResources/ssl/cert.pem`)
        }catch(error){
            console.log(`Could not find SSL certificate or key; resorting to http server.`)
        }
        
        server.requests.importMimeTypes()
        server.requests.load404Page()

        let serverRunTime

        if(server.ssl.key != null && server.ssl.cert != null){
            serverRunTime = https.createServer(server.ssl, server.requests.listener)
            serverRunTime.listen(server.hostOptions.port, server.hostOptions.host, () => {console.log(`HTTPS server running on https://${server.hostOptions.host}:${server.hostOptions.port}.`)})
        }else{
            serverRunTime = http.createServer(server.requests.listener)
            serverRunTime.listen(server.hostOptions.port, server.hostOptions.host, () => {console.log(`HTTP server running on http://${server.hostOptions.host}:${server.hostOptions.port}.`)})
        }
        
        serverRunTime.keepAliveTimeout = 5000
        serverRunTime.headersTimeout = 6000
    }
}
server.start()
