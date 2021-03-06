const {console} = require('./logger')
const Dequeue = require('./bfsQueueLikeStructure')//require('double-ended-queue')
const {isMatch, _getPath} = require('./utils')
const take_ = require('lodash/take') 

let result
let initialPath = ''
const objOrFuncRegex = /(?:function|object)/
let findcount = 0
let queueLike
let nonExtensibleVisitedSet
let maxDepthLookedInto
const _limit = 300000

function isDomNode(node) {
   if( typeof node !== "object") {
       return false
   }
   try{
       return node && typeof node.nodeType === "number" && typeof node.nodeName==="string"
   }catch(e) {
       //avoid error of type `Blocked a frame with origin "https://editor.wix.com" from accessing a cross-origin frame.`
       return true
   }
}

function shouldProcessNext(node, parent) {
    if (!node) {
        return false
    }
    if (!Object.isExtensible(node)) {
        return !nonExtensibleVisitedSet.has(node)
    }
    return objOrFuncRegex.test(typeof node) && !node.__visited
}
function unmark(){
    let node
    while(node = queueLike.pop()){
        delete node.__parent
        delete node.__visited
        delete node.__depth
        delete node.__key
        delete node.__printed
    }
}

function fplog(path) {
    findcount % 2 ? 
        console.log(`%c${path}`, 'background-color:#242424;color:#bdc6cf') :
        console.log(`%c${path}`, 'background-color:#242424;color:#bcb2a2')
}
function handlePossibleMatch(key, prop, parent, node) {
   //todo allow to match path
   if(isMatch(key, key, prop)){
       const path = _getPath(parent, key, initialPath)
       --findcount
       fplog(path)
       // console.log(path)
       result.set(path, node)
   }
}
function processNode(prop, parent, node, key) {
    if(Object.isExtensible(node)){
        node.__key = key
        node.__visited = 1
        node.__depth = parent.__depth + 1
        node.__parent = parent
    } else {
        nonExtensibleVisitedSet.add(node)
        node = {
            __original: node,
            __key: key,
            __visited: 1,
            __depth: parent.__depth + 1,
            __parent: parent
        }
    }
    handlePossibleMatch(key, prop, parent, node)
    queueLike.enqueue(node)
}

function processNodeIfNeeded(prop, parent, key) {
    if (key === 's' && parent.__key === 'require') {
        return
    }
    if(!(/(?:^requirejs$|_renderedComponent|_reactInternalFiber|_reactBoundContext|_reactInternalInstance|__key|__visited|__parent|__depth)/.test(key))){
        const originalNode = parent.__original || parent
        let node = originalNode[key]
        if(isDomNode(node)) {
            return
        }
        if(shouldProcessNext(node, originalNode)){
            processNode(prop, parent, node, key)
            return true
        } else if (Object.isExtensible(originalNode)) {
            if(isMatch(key, key, prop) && (!originalNode.__printed || !originalNode.__printed.has(key))){
                originalNode.__printed = originalNode.__printed || new Set()
                originalNode.__printed.add(key)
                handlePossibleMatch(key, prop, parent, node)
            }
        }
    }
}

function findPath(node, limit, prop) {
    let iterations = 0
    while ( node && ++iterations < limit && findcount > 0){
        const originalNode = node.__original || node
        maxDepthLookedInto = node.__depth
        for(var k in originalNode) {
            processNodeIfNeeded(prop, node, k) && iterations++
        }
        node = queueLike.dequeue()
    }
    return {
        lastProcessedObj: node
    }

}

function extractRoot(root){
    initialPath = ''
    if (!root) {
        root = window
    } else if (typeof root === 'string') {
        initialPath = root
        let windowObjPath = root.split('.')
        root = window
        windowObjPath.forEach(p => root = root[p])
    }
    return root

}
function setup(rootArg){
    result = new Map()
    nonExtensibleVisitedSet = new Set()
    maxDepthLookedInto = 0
    queueLike = new Dequeue()
    const root = extractRoot(rootArg)
    queueLike.enqueue(root)
    root.__visited = 1
    root.__depth = 1
    return {root}
}

function getArguments(){
    findcount = 1000000
    let limit = _limit
    if(arguments.length === 1 ){
        findcount = 20
        return {
            prop: arguments[0],
            limit
        }
    }
    if((arguments.length === 2 && typeof arguments[1] === 'number')){
        let limit
        if(arguments[1] < 150){
            findcount = arguments[1]
            limit = 1000000
        } else {
            limit = arguments[1]
        }
        return {
            prop: arguments[0],
            limit,
        }
    }
    return {
        rootArg: arguments[0],
        prop: arguments[1],
        limit: arguments[2] || _limit
    }
}
function findPathBFS(...args){
    console.time('fpBFS')
    const {rootArg, prop, limit} = getArguments(...args) 
    const {root} = setup(rootArg)
    findPath(root, limit, prop)
    unmark()
    console.log('max depth looked into = ', maxDepthLookedInto)
    console.timeEnd('fpBFS')
}

findPathBFS.get = keyOrRegex => {
    if (typeof keyOrRegex === 'string') keyOrRegex = new RegExp(keyOrRegex)
    const fn = keyOrRegex instanceof RegExp ? keyOrRegex.test : keyOrRegex
    result.forEach((val, key) => {
       if(fn(key)){
          console.log(`%c${key}`, 'color:#5db0d7')
          console.log(val, '\n')
       }
    })
}
findPathBFS.filter = keyOrRegex => {
    if (typeof keyOrRegex === 'string') keyOrRegex = new RegExp(keyOrRegex)
        let arr = []
    for (let [key] of result.entries()) {
        if (keyOrRegex instanceof RegExp) {
            if(keyOrRegex.test(key))
                arr.push(key)
        } else if(typeof keyOrRegex === 'function'){
            if(keyOrRegex(key))
                arr.push(key)
        }
    }
    logArr(arr)
}

findPathBFS.take = (val = 10) => {
    let i = 0
    let arr = []
    for (let [key] of result.entries()) {
        if(++i > val) break
        arr.push(key)
    }
    logArr(arr)
}

const logArr = arr => {
    arr.forEach(a => console.log(a))
}

findPathBFS.reverse = () => {
    const arr = []
    for (let [key] of result.entries()) {
        arr.push(key)
    }
    logArr(arr)
}

Object.defineProperties(findPathBFS, {
    details: {
        get: () => {
            result.forEach((value, key) => {
                console.log('%c'+key, 'font-weight:bold;color:#5db0d7;')
                console.log(value)
            })
        }
    },
    result: {
        get: () => result
    },
    reverse: {
        get: () => {
            let res = []
            for (let key of result.keys()) {
                res.push(key)
            }
            logArr(res.reverse())
        }
    }
})

module.exports = findPathBFS
