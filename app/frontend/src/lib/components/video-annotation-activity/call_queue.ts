
type Call = () => Promise<void|any>
let calls:(Call)[] = []
let processing = false
const MAX_RETRY = 3
let retries = 0
let last_call:Call|undefined

function register_call(call: Call) {
    calls.push(call)

    if (!processing) process_calls()
}

function process_calls() {
    processing = true
    let call = calls.shift()

    if (!call) {
        processing = false
    } else {
        call()
        .then((e) => { // OK
            console.log({e})
            process_calls()
        }, (e) => { // KO
            console.log({e})
            calls.unshift(call)
            processing = false
            if (last_call != call) {
                retries = 0
                last_call = call
            } else {
                if (retries >= MAX_RETRY) {
                    processing = false
                    return
                }
            }
            retries += 1
            process_calls()
        })
    }
}

function retry() {
    if (!processing) process_calls()
}

const callQueue = {
    register_call,
    retry
}


export default callQueue