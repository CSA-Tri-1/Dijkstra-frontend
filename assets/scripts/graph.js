// initial variables for function and JointJS graph
let startView;
let endView;
// path storage array
let pathMembersViews = [];
// JointJS vars for styling
const pathMemberHighlightId = 'path-member';
const invalidPathHighlightId = 'invalid-path-member';
const pathMemberClassName = 'path-member';
const invalidPathClassName = 'invalid-path';
const highlightId = 'start-highlight';
const blueColor = '#54ccff';
const blackColor = '#222222';
const invalidColor = '#FF4365';
const outlineColor = '#616161';
const startAttrs = {
    padding: 2,
    attrs: {
        stroke: blueColor,
        'stroke-width': 2
    }
};
// initial node ID
let nextId = 0;
// control edit or view mode
let editMode = true;
// node styling
const size = 40;
const getTargetMarkerStyle = () => ({
    type: 'path',
    d: null ,
    fill: blackColor,
    stroke: blackColor,
    tools: {
        linkTools: []
    }
});
// link styling when highlighted
const getLinkStyle = () => {
    return V.createSVGStyle(`
    .joint-link .${pathMemberClassName} {
        animation: stroke 1s ease-in-out infinite alternate;
    }
`);
}
// start and end views
const getStartView = () => startView;
const getEndView = () => endView;
// setting up graph for JointJS
const graph = new joint.dia.Graph;
const paperElement = document.getElementById('interactive-graph');
const paper = new joint.dia.Paper({
    el: paperElement,
    width: 800,
    height: 650,
    gridSize: 1,
    model: graph,
    sorting: joint.dia.Paper.sorting.APPROX,
    defaultLink: () => new joint.shapes.standard.Link({
        attrs: {
            line: {
                targetMarker: getTargetMarkerStyle(),
                stroke: outlineColor
            }
        },
    }),
    defaultConnectionPoint: { name: 'boundary', args: { offset: 4 }},
    linkPinning: false,
    async: true,
    frozen: false,
    // makes graph interactive
    interactive: () => editMode,
    // checks connections with links
    validateConnection: (cellViewS, _magnetS, cellViewT) => {
        const id = [cellViewS.model.id, cellViewT.model.id].sort().join();
        const existingLink = graph.getCell(id);
        const isSameCell = cellViewS.model.id === cellViewT.model.id;
        return !isSameCell && !existingLink && !cellViewT.model.isLink();
    },
    highlighting: {
        connecting: {
            name: 'mask',
            options: {
                padding: 2,
                attrs: {
                    stroke: blueColor,
                    'stroke-width': 2
                }
            }
        }
    }
});
var namespace = joint.shapes;

// reloads page and clears graph to restart for user
document.getElementById('restart-button').addEventListener('click', function(evt) {
    editMode = evt.target.checked
    location.reload();
    toggleView();
    graph.clear();
});

// listener controller for Joint graph
class Controller extends joint.mvc.Listener {
    get context() {
        const [ctx = null] = this.callbackArguments;
        return ctx;
    }
}

// view controller, controlling display of shortest path with listeners
class ViewController extends Controller {
    startListening() {
        const { paper } = this.context;

        // activate functions with certain listeners
        this.listenTo(paper, {
            'element:pointerdown': selectSource,
            'element:mouseenter': selectEnd,
            'element:mouseleave': hidePathOnMouseLeave,
        });
    }
}

// selecting the start node
function selectSource({ setStartView }, elementView) {
    setStartView(elementView);
}

// hovering over the end node (displays entire path)
function selectEnd({ showPath, setEndView, getStartView, getEndView }, elementView) {
    const pathStartView = getStartView();
    const pathEndView = getEndView();

    // checks for if start and end are the same
    if (elementView === pathStartView) return;

    // checks for invalid path connection
    if (pathStartView && pathEndView) {
        joint.highlighters.addClass.remove(pathStartView, invalidPathHighlightId);
        joint.highlighters.addClass.remove(pathEndView, invalidPathHighlightId);
    }
    setEndView(elementView);

    // shows path
    showPath();
}

// hide path and highlight on mouse leave
function hidePathOnMouseLeave({ hidePath, getStartView, getEndView, setEndView }) {
    const pathStartView = getStartView();
    const pathEndView = getEndView();
    
    // hides path
    hidePath();

    // check for invalid path
    if (pathStartView) joint.highlighters.addClass.remove(pathStartView, invalidPathHighlightId);
    if (pathEndView) joint.highlighters.addClass.remove(pathEndView, invalidPathHighlightId);

    // reset end node
    setEndView(null);
}

// edit controller with listening
class EditController extends Controller {
    startListening() {
        const { graph, paper } = this.context;

        // adding links
        this.listenTo(graph, {
            'change:source': replaceLink,
            'change:target': replaceLink,
        });

        // adding nodes
        this.listenTo(paper, {
            'element:mouseenter': showElementTools,
            'element:mouseleave': hideElementTools,
            'blank:pointerdblclick': addElement
        });
    }
}

// elements tools, allow for editing
function showElementTools(_context, elementView, _evt) {
    elementView.showTools();
}
function hideElementTools(_context, elementView) {
    elementView.hideTools();
}

// adding link function
function replaceLink({ createLink }, link, _collection, opt) {
    const sourceId = link.get('source').id;
    const targetId = link.get('target').id;
    // this is done to prevent JointJS from breaking
    if (opt.ui && sourceId && targetId) {
        createLink(sourceId, targetId);
        link.remove();
    }
    
}

// adding node and logging it for backend in array
function addElement({ createNode, size }, _evt, x, y) {
    // node function creating node
    const node = createNode(getNodeId(), x - size / 2, y - size / 2);
    node.position(x - size / 2, y - size / 2);
    nodes_array.push(node);
}

// listens for change in node position to update for calculating weight
graph.on('change:position', function(cell) {
    if (cell.isElement()) {
        const nodeId = cell.id;
        const center = cell.getBBox().center();
        node_coords[nodeId] = center;
    }
});

// init controller subclasses
const viewController = new ViewController({ paper, showPath, hidePath, setStartView, setEndView, getStartView, getEndView });
const editController = new EditController({ graph, paper, createLink, createNode, setStartView, setEndView, getStartView, size });

// begins listening for edits
editController.startListening();

// finds current index of node in question
function getCurrentID() {
    return current_index;
}

// used to get next nodeID
function getNodeId() {
    current_index++;
    return current_index;
}

// get node by specific ID
function getNodefromId(id) {
    for (let i = 0; i < nodes_array.length; i++) {
        if (nodes_array[i].id == id) {
            return nodes_array[i];
        }
    }
}

// creating node
function createNode(id) {
    // set up node for JointJS with attributes
    var node = new joint.shapes.standard.Circle({
        id,
        size: { width: 40, height: 40 },
        attrs: {
            body: {
                fill: 'black'
            },
            label: {
                fill: 'white'
            }
        }
    }).addTo(graph);
    var view = node.findView(paper);

    // sets up tools that are used for node connection with links
    view.addTools(new joint.dia.ToolsView({
        tools: [
            new joint.elementTools.HoverConnect({
                useModelGeometery: true,
                trackPath: V.convertCircleToPathData(joint.V(`<circle cx="${ 40 / 2 }" cy="${ 40 / 2 }" r="${ 40 / 2 }" />`))
            }),
        ]
    }))
    
    // sets view and tools in use
    view.hideTools();
    node.attr('label/text', id);
    return node;
}

// creating links between nodes on map
function createLink(s, t) {
    // init for distance formula
    let x1 = getNodefromId(s).attributes.position.x
    let x2 = getNodefromId(t).attributes.position.x
    let y1 = getNodefromId(s).attributes.position.y
    let y2 = getNodefromId(t).attributes.position.y
    // default settings for link styling and attributes
    var link = new joint.shapes.standard.Link({
        id: [s, t].sort().join(),
        source: { id: s },
        target: { id: t },
        z: 1,
        distance: Math.ceil(Math.sqrt((x1-x2)**2 + (y1-y2)**2)*(20/Math.sqrt(400**2 + 800**2))),
        attrs: {
            label: {
                pointerEvents: 'none'
            },
            body: {
                pointerEvents: 'none'
            },
            wrapper: {
                stroke: 'white',
                'stroke-width': 6
            },
            line: { targetMarker: getTargetMarkerStyle(), stroke: outlineColor } 
        },
    });

    // visual representation of links
    link.appendLabel({
        attrs: {
            text: {
                text: link.attributes.distance,
                fill: 'white' 
            },
            rect: {
                rx: 3,
                fill: blackColor,
                stroke: blackColor,
                strokeWidth: 8
            }
        }
    });

    // creation of adjacency list for display of path
    if (link.attributes.target.hasOwnProperty("id")) {

        // push edge weights for adj_array
        const sId = link.attributes.source.id;
        const tId = link.attributes.target.id;
        const distance = link.attributes.distance;

        // fills in second adjacency array to later build main adjacency list
        adj_array.push([sId - 1, tId - 1, distance])
    }

    link.addTo(graph);
    
    // display of links, styling
    var view = link.findView(paper);
    view.addTools(new joint.dia.ToolsView({
        tools: []
    }));
    edge_array.push(link)
    view.hideTools();
}


// setting start view of graph
function setStartView(elementView) {
    // hide path if visible
    hidePath();

    // removes old start node when clicked
    if (startView) {
        joint.highlighters.mask.remove(startView, highlightId);
        joint.highlighters.addClass.remove(startView, invalidPathHighlightId);
    }

    // if the start is an end node, remove end node
    if (endView) {
        joint.highlighters.addClass.remove(endView, invalidPathHighlightId);
    }

    // change styling on new start node
    if (elementView) {
        joint.highlighters.mask.add(elementView, 'body', highlightId, startAttrs);
    }
    // define new start
    startView = elementView;
    // send data to backend
    start.length = 0
    start.push(elementView.model.id)
}

// setting end node
function setEndView(elementView) {
    // function activated when hover
    endView = elementView
    // send data to backend
    end.length = 0
    end.push(elementView.model.id)
}

// get path from backend
function getElementPath() {
    // debug
    console.log('Current start and end values:', start, end);
    console.log('Current adj_List:', adj_List);

    // create adjacency list by filling all with infinity
    adj_List = Array(current_index).fill().map(() => Array(current_index).fill(10000));
    // using weight data from second adj list for main adj list
    for (let i = 0; i < adj_array.length; i++) {
      adj_List[adj_array[i][0]][adj_array[i][1]] = adj_array[i][2];
      adj_List[adj_array[i][1]][adj_array[i][0]] = adj_array[i][2];
    }
    // setting empty values with 0 for nodes connected to themselves
    for (let i = 0; i < current_index; i ++){
      adj_List[i][i] = 0;
    }

    // defines data set to backend
    const payload = {
        adjacencyList: adj_List,
        source: parseInt(start),
        target: parseInt(end)
    };

    // Backend URL
    const backendURL = 'http://localhost:8084/api/dijkstra/';

    // Creating a new XMLHttpRequest object
    const xhr = new XMLHttpRequest();
    xhr.open('POST', backendURL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    // Handling the response from the server
    // uses promises to wait for response before displaying
    return new Promise((resolve) => {
        xhr.onload = function() {
        
            if(xhr.status >= 200 && xhr.status < 300) {
                const response = JSON.parse(xhr.responseText);
                console.log('Response from server:', response);
                
                resolve(response)
            } else {
                console.error('Request failed with status:', xhr.status);
            }
            };
        
            // Handling errors during the request
            xhr.onerror = function() {
            console.error('Request failed');
            };
        
            // Sending the request with the JSON payload
            xhr.send(JSON.stringify(payload));
    });
}

// getting path from backend
function getLinkPath(elementPath) {
    const linkPath = [];

    // finds all paths connecting nodes
    if (startView) {
        for (let i = 0; i < elementPath.length - 1; i++) {
            const sourceId = elementPath[i];
            const targetId = elementPath[i + 1];
            const link = graph.getCell([sourceId, targetId].sort().join());
            // checks for if element is link
            if (!link) continue;
            // sends the links to showPath()
            linkPath.push(link.id);
        }
    }

    return linkPath;
}

// showing path
async function showPath() {

    // sets element path from data from backend, awaiting for response
    const elementPath = await getElementPath();
    // checks if path is found
    const isPathFound = elementPath.length > 0;
    // highlights for non-existent path
    if (!isPathFound && startView && endView && startView.id !== endView.id && !editMode) {
        joint.highlighters.addClass.add(startView, 'body', invalidPathHighlightId, {
            className: invalidPathClassName
        });
        joint.highlighters.addClass.add(endView, 'body', invalidPathHighlightId, {
            className: invalidPathClassName
        });
        // doesn't show path
        hidePath();
        return;
    }

    // removes if start and end don't exist
    if (startView) joint.highlighters.addClass.remove(startView, invalidPathHighlightId);
    if (endView) joint.highlighters.addClass.remove(endView, invalidPathHighlightId);
    hidePath();

    // gets link path between node path
    const linkPath = getLinkPath(elementPath);
    // display all elements
    for (const elementId of [...elementPath, ...linkPath]) {
        const element = graph.getCell(elementId);
        const view = element.findView(paper);
        const isLink = view.model.isLink();
        // styles nodes
        joint.highlighters.addClass.add(view, isLink ? 'line' : 'body', pathMemberHighlightId, {
            className: pathMemberClassName
        });
        // sets link styles
        if (isLink) {
            element.set('z', 2);
        }

        // creates path members array
        pathMembersViews.push(view);
    }
}

// hiding path
function hidePath() {
    // reset styling for all elements on path array
    for (const view of pathMembersViews) {
        const model = view.model;
        joint.highlighters.addClass.remove(view, pathMemberHighlightId);

        if (model.isLink()) {
            model.set('z', 1);
            model.labels([]);
        }
    }

    // clear array
    pathMembersViews = [];
}

// creating link style
function toggleLinkStyle() {
    // check for existing style and remove
    if (linkStyle) paper.svg.removeChild(linkStyle);

    // setting canvas styles
    linkStyle = getLinkStyle();
    paper.svg.prepend(linkStyle);
}

// styles of the graph members
const styles = V.createSVGStyle(`
    .joint-element .${pathMemberClassName} {
        stroke: ${blueColor};
        fill: ${blueColor};
        fill-opacity: 0.75;
    }
    .joint-element .${invalidPathClassName} {
        stroke: ${invalidColor};
        fill: ${invalidColor};
        fill-opacity: 0.2;
    }
    @keyframes dash {
        to {
            stroke-dashoffset: 0;
        }
    }
    @keyframes stroke {
        to {
            stroke: ${blueColor};
        }
    }
`);

// setting styles
let linkStyle = getLinkStyle();

// creating styles
paper.svg.prepend(styles);
paper.svg.prepend(linkStyle);

// zoom
var zoomLevel = 1;

// zooming in
document.getElementById('zoom-in').addEventListener('click', function() {
    // enlarging all elements on canvas
    zoomLevel = Math.min(3, zoomLevel + 0.2);
    var size = paper.getComputedSize();
    paper.translate(0,0);
    paper.scale(zoomLevel, zoomLevel, size.width / 2, size.height / 2);
});

// zooming out
document.getElementById('zoom-out').addEventListener('click', function() {
    // minimizing all elements on canvas
    zoomLevel = Math.max(0.2, zoomLevel - 0.2);
    var size = paper.getComputedSize();
    paper.translate(0,0);
    paper.scale(zoomLevel, zoomLevel, size.width / 2, size.height / 2);
});

// switch between view and edit controllers
function toggleView() {
    // change cursor style
    for (const element of graph.getElements()) {
        element.attr('body/cursor', editMode ? 'move' : 'pointer');
    }

    // start edit mode listening
    if (editMode) {
        //listening functions
        viewController.stopListening();
        editController.startListening();
        // hide paths
        hidePath();
        // removing styling of start and end
        if (startView) {
            joint.highlighters.mask.remove(startView, highlightId);
            joint.highlighters.addClass.remove(startView, invalidPathHighlightId);
        }
        if (endView) {
            joint.highlighters.addClass.remove(endView, invalidPathHighlightId);
        }
    // starting view mode listening
    } else {
        // turn off editing listening
        viewController.startListening();
        editController.stopListening();
        // show path
        showPath();
        // create styling for start
        if (startView) {
            joint.highlighters.mask.add(startView, 'body', highlightId, startAttrs);
        }
    }
}

// toggle from edit to view and back
document.getElementById('edit-mode-toggle').addEventListener('click', function(evt) {
    editMode = evt.target.checked
    toggleView();
});