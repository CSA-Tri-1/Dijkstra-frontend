let startView;
let endView;
let pathMembersViews = [];
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
let nextId = 0;
let editMode = true;
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
const getLinkStyle = () => {
    return V.createSVGStyle(`
    .joint-link .${pathMemberClassName} {
        animation: stroke 1s ease-in-out infinite alternate;
    }
`);
}
const getStartView = () => startView;
const getEndView = () => endView;

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
    interactive: () => editMode,
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

document.getElementById('restart-button').addEventListener('click', function(evt) {
    editMode = evt.target.checked
    location.reload();
    toggleView();
    graph.clear();
});

class Controller extends joint.mvc.Listener {
    get context() {
        const [ctx = null] = this.callbackArguments;
        return ctx;
    }
  }

  class ViewController extends Controller {
    startListening() {
        const { paper } = this.context;

        this.listenTo(paper, {
            'element:pointerdown': selectSource,
            'element:mouseenter': selectEnd,
            'element:mouseleave': hidePathOnMouseLeave,
        });
    }
}

function selectSource({ setStartView }, elementView) {
    setStartView(elementView);
}

function selectEnd({ showPath, setEndView, getStartView, getEndView }, elementView) {
    const pathStartView = getStartView();
    const pathEndView = getEndView();

    if (elementView === pathStartView) return;
    if (pathStartView && pathEndView) {
        joint.highlighters.addClass.remove(pathStartView, invalidPathHighlightId);
        joint.highlighters.addClass.remove(pathEndView, invalidPathHighlightId);
    }
    setEndView(elementView);
    showPath();
}

function hidePathOnMouseLeave({ hidePath, getStartView, getEndView, setEndView }) {
    const pathStartView = getStartView();
    const pathEndView = getEndView();

    hidePath();
    if (pathStartView) joint.highlighters.addClass.remove(pathStartView, invalidPathHighlightId);
    if (pathEndView) joint.highlighters.addClass.remove(pathEndView, invalidPathHighlightId);
    setEndView(null);
}


class EditController extends Controller {
    startListening() {
        const { graph, paper } = this.context;

        this.listenTo(graph, {
            'change:source': replaceLink,
            'change:target': replaceLink,
        });

        this.listenTo(paper, {
            'element:mouseenter': showElementTools,
            'element:mouseleave': hideElementTools,
            'element:pointerdblclick': removeElement,
            'blank:pointerdblclick': addElement
        });
    }
}

function showElementTools(_context, elementView, _evt) {
    elementView.showTools();
}

function hideElementTools(_context, elementView) {
    elementView.hideTools();
}

// When a new link is created via UI (in Edit mode), remove the previous link
// and create a new one that has the ID constructed as "nodeA,nodeB". The
// reason we're removing the old link below is that it is not a good idea
// to change ID's of any model in JointJS.
function replaceLink({ createLink }, link, _collection, opt) {
    const sourceId = link.get('source').id;
    const targetId = link.get('target').id;
    if (opt.ui && sourceId && targetId) {
        createLink(sourceId, targetId);
        link.remove();
    }
    
}

function removeElement({ setStartView, setEndView, getStartView }, elementView) {
    const pathStart = getStartView();
    if (elementView.model.id === pathStart.model.id) {
        setStartView(null);
        setEndView(null);
    }
    
    elementView.model.remove();
}

function addElement({ createNode, size }, _evt, x, y) {
    const node = createNode(getNodeId(), x - size / 2, y - size / 2);
    node.position(x - size / 2, y - size / 2);
    nodes_array.push(node);
}

graph.on('change:position', function(cell) {
    if (cell.isElement()) {
        const nodeId = cell.id;
        const center = cell.getBBox().center();
        node_coords[nodeId] = center;
    }
});

const viewController = new ViewController({ paper, showPath, hidePath, setStartView, setEndView, getStartView, getEndView });
const editController = new EditController({ graph, paper, createLink, createNode, setStartView, setEndView, getStartView, size });

editController.startListening();

function getCurrentID() {
    return current_index;
}
function getNodeId() {
    current_index++;
    return current_index;
}

function getNodefromId(id) {
    for (let i = 0; i < nodes_array.length; i++) {
        if (nodes_array[i].id == id) {
            return nodes_array[i];
        }
    }
}

function createNode(id) {
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
    view.addTools(new joint.dia.ToolsView({
        tools: [
            new joint.elementTools.HoverConnect({
                useModelGeometery: true,
                trackPath: V.convertCircleToPathData(joint.V(`<circle cx="${ 40 / 2 }" cy="${ 40 / 2 }" r="${ 40 / 2 }" />`))
            }),
        ]
    }))
    
    view.hideTools();
    node.attr('label/text', id);
    return node;
}

// creating links between nodes on map
function createLink(s, t) {
    let x1 = getNodefromId(s).attributes.position.x
    let x2 = getNodefromId(t).attributes.position.x
    let y1 = getNodefromId(s).attributes.position.y
    let y2 = getNodefromId(t).attributes.position.y
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

    if (link.attributes.target.hasOwnProperty("id")) {

        // push edge weights for adj_array
        const sId = link.attributes.source.id;
        const tId = link.attributes.target.id;
        const distance = link.attributes.distance;


        const maxId = Math.max(sId, tId);

        while (adj_List.length < maxId) {
            adj_List.push(Array(maxId).fill(10000));
        }

        adj_array.push([sId - 1, tId - 1, distance])
    }

    link.addTo(graph);
    
    var view = link.findView(paper);
    view.addTools(new joint.dia.ToolsView({
        tools: []
    }));
    edge_array.push(link)
    view.hideTools();
}



function setStartView(elementView) {
    hidePath();
    if (startView) {
        joint.highlighters.mask.remove(startView, highlightId);
        joint.highlighters.addClass.remove(startView, invalidPathHighlightId);
    }

    if (endView) {
        joint.highlighters.addClass.remove(endView, invalidPathHighlightId);
    }

    if (elementView) {
        joint.highlighters.mask.add(elementView, 'body', highlightId, startAttrs);
    }
    startView = elementView;
    start.length = 0
    start.push(elementView.model.id)
}

function setEndView(elementView) {
    endView = elementView
    end.length = 0
    end.push(elementView.model.id)
}

function getElementPath() {
    console.log('Current start and end values:', start, end);
    console.log('Current adj_List:', adj_List);

    adj_List = Array(current_index).fill().map(() => Array(current_index).fill(10000));
    for (let i = 0; i < adj_array.length; i++) {
      adj_List[adj_array[i][0]][adj_array[i][1]] = adj_array[i][2];
      adj_List[adj_array[i][1]][adj_array[i][0]] = adj_array[i][2];
    }
    for (let i = 0; i < current_index; i ++){
      adj_List[i][i] = 0;
    }

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
    return new Promise((resolve, reject) => {
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

function getLinkPath(elementPath) {
    const linkPath = [];

    if (startView) {
        for (let i = 0; i < elementPath.length - 1; i++) {
            const sourceId = elementPath[i];
            const targetId = elementPath[i + 1];
            const link = graph.getCell([sourceId, targetId].sort().join());
            if (!link) continue;

            linkPath.push(link.id);
        }
    }

    return linkPath;
}

async function showPath() {
   
        const elementPath = await getElementPath();
        const isPathFound = elementPath.length > 0;
        if (!isPathFound && startView && endView && startView.id !== endView.id && !editMode) {
            joint.highlighters.addClass.add(startView, 'body', invalidPathHighlightId, {
                className: invalidPathClassName
            });
            joint.highlighters.addClass.add(endView, 'body', invalidPathHighlightId, {
                className: invalidPathClassName
            });
            hidePath();
            return;
        }
    
        if (startView) joint.highlighters.addClass.remove(startView, invalidPathHighlightId);
        if (endView) joint.highlighters.addClass.remove(endView, invalidPathHighlightId);
        hidePath();
        const linkPath = getLinkPath(elementPath);
    
        for (const elementId of [...elementPath, ...linkPath]) {
            const element = graph.getCell(elementId);
            const view = element.findView(paper);
            const isLink = view.model.isLink();
            joint.highlighters.addClass.add(view, isLink ? 'line' : 'body', pathMemberHighlightId, {
                className: pathMemberClassName
            });
    
            if (isLink) {
                element.set('z', 2);
            }
    
            pathMembersViews.push(view);
        }
   

    // document.getElementById('path').innerText = elementPath.join(' → ');
}

function hidePath() {
    for (const view of pathMembersViews) {
        const model = view.model;
        joint.highlighters.addClass.remove(view, pathMemberHighlightId);

        if (model.isLink()) {
            model.set('z', 1);
            model.labels([]);
        }
    }

    pathMembersViews = [];
}

function toggleLinkStyle() {
    if (linkStyle) paper.svg.removeChild(linkStyle);

    linkStyle = getLinkStyle();
    paper.svg.prepend(linkStyle);
}

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

let linkStyle = getLinkStyle();

paper.svg.prepend(styles);
paper.svg.prepend(linkStyle);

var zoomLevel = 1;

document.getElementById('zoom-in').addEventListener('click', function() {
    zoomLevel = Math.min(3, zoomLevel + 0.2);
    var size = paper.getComputedSize();
    paper.translate(0,0);
    paper.scale(zoomLevel, zoomLevel, size.width / 2, size.height / 2);
});

document.getElementById('zoom-out').addEventListener('click', function() {
    zoomLevel = Math.max(0.2, zoomLevel - 0.2);
    var size = paper.getComputedSize();
    paper.translate(0,0);
    paper.scale(zoomLevel, zoomLevel, size.width / 2, size.height / 2);
});

function toggleView() {
    for(const element of graph.getElements()) {
        element.attr('body/cursor', editMode ? 'move' : 'pointer');
    }

    if (editMode) {
        viewController.stopListening();
        editController.startListening();
        hidePath();
        if (startView) {
            joint.highlighters.mask.remove(startView, highlightId);
            joint.highlighters.addClass.remove(startView, invalidPathHighlightId);
        }
        if (endView) {
            joint.highlighters.addClass.remove(endView, invalidPathHighlightId);
        }
    } else {
        viewController.startListening();
        editController.stopListening();
        showPath();
        if (startView) {
            joint.highlighters.mask.add(startView, 'body', highlightId, startAttrs);
        }
    }
}

document.getElementById('edit-mode-toggle').addEventListener('click', function(evt) {
    editMode = evt.target.checked
    toggleView();
});