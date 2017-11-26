const Dequeue = require('./bfsQueueLikeStructure')//require('double-ended-queue')
const {isMatch, _getPath} = require('./utils')

let result
let initialPath = ''
const objOrFuncRegex = /(?:function|object)/
const isDomNode = node => typeof node == "object" && typeof node.nodeType === "number" && typeof node.nodeName==="string"
let findcount = 0
let queueLike
let nonExtensibleVisitedSet
let maxDepthLookedInto

function shouldProcessNext(node) {
    if (!node) {
        return false
    }
    if (!Object.isExtensible(node)) {
        return !nonExtensibleVisitedSet.has(node)
    }
    return objOrFuncRegex.test(typeof node) && !isDomNode(node) && !node.__visited
}
function unmark(){
    let node
    while(node = queueLike.pop()){
        delete node.__parent
        delete node.__visited
        delete node.__depth
        delete node.__key
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
    //todo allow to match path
    if(isMatch(key, key, prop)){
        const path = _getPath(parent, key, initialPath)
        findcount = ++findcount % 2
        findcount ? console.log(`%c${path}`, 'background-color:#242424;color:#bdc6cf'): console.log(`%c${path}`, 'background-color:#242424;color:#bcb2a2')
        // console.log(path)
        result.set(path, node)
    }
    queueLike.enqueue(node)
}

function processNodeIfNeeded(prop, parent, key) {
    if(!(/(?:^requirejs$|_reactBoundContext|_reactInternalInstance|__key|__visited|__parent|__depth)/.test(key))){
        const originalNode = parent.__original || parent
        let node = originalNode[key]
        if(shouldProcessNext(node, originalNode)){
            processNode(prop, parent, node, key)
            return true
        }
    }
}

function findPath(node, limit, prop) {
    let iterations = 0
    while ( node && ++iterations < limit){
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
function findPathBFS(rootArg, prop, limit = 300000){
    //todo: we need a set of isExtensible=false visited nodes
    //todo: get rid of this Dequeue, use an array instead
    console.time('fpBFS')
    const {root} = setup(rootArg)
    const {lastProcessedObj} = findPath(root, limit, prop)
    console.log('max depth looked into = ', maxDepthLookedInto)
    unmark()
    console.timeEnd('fpBFS')
}
findPathBFS.get = keyOrRegex => {
    if (keyOrRegex instanceof RegExp) {
        result.forEach((val, key) => {
            if(keyOrRegex.test(key)){
                console.log(`%c${key}`, 'color:#5db0d7')
                console.log(val, '\n')
            }
        })
    }
    return result.get(keyOrRegex)
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
    }
})

module.exports = findPathBFS
