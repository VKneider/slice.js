 export default class FetchManager {
    constructor(baseUrl, timeout) {
        if(baseUrl != undefined){
            this.url = baseUrl;
        }
        this.methods = ["GET", "POST", "PUT", "DELETE"];
        
        if(timeout != undefined){
            this.timeout = timeout;
        } else {this.timeout=5000}
    }

    async request(method, data, endpoint) {

        if (!this.methods.includes(method)) throw new Error("Invalid method");
        if(data && typeof data !== "object") throw new Error("Invalid data, not json");
        const controller = new AbortController()

        let options;
        if(method !="GET"){
            options = {
                method: method,
                headers: {
                    "Content-Type": "application/json"
                },
                signal: controller.signal,
            }
        }else{
            options = {
                method: method,
                signal: controller.signal,
            }
        }
        
        
        if(data!=null){
            options.body = JSON.stringify(data);
        }
        
        if(slice.controller.components.has("myLoading")){
            slice.controller.components.delete("myLoading")
        }
        
        let loading = await slice.getInstance("Loading", {id:"myLoading"});
        loading.start();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout || 10000)

        let response;
        if(this.baseUrl != undefined){
         response = await fetch(this.url + endpoint, options);
        }else{
          response = await fetch(endpoint, options);
        }
        
        let output = await response.json();
        loading.stop();

        return output;
    }
        
}

