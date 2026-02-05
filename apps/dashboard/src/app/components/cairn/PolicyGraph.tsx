import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  MarkerType,
  Handle,
  Position,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Shield, Zap, Cpu, Database, Share2, X } from "lucide-react";

interface PolicyGraphProps {
  nodes: Record<string, any>;
  edges: Record<string, string[]>;
}

// Custom node component that shows agent details
function AgentNode({ data }: { data: any }) {
  const getIcon = (name: string) => {
    if (name === "gatekeeper") return <Shield size={20} />;
    if (name === "planner") return <Zap size={20} />;
    return <Cpu size={20} />;
  };

  return (
    <div className="bg-[#F3F2EE] border-2 border-[#1A1D21]/30 rounded-xl p-4 shadow-lg min-w-[220px] hover:shadow-xl transition-all hover:border-[#1A1D21]/60">
      {/* Connection handles for edges */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-[#1A1D21]/10 rounded-lg text-[#1A1D21]">
          {getIcon(data.name)}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm uppercase tracking-wider">
            {data.name}
          </h3>
          <div className="text-[9px] opacity-40 font-mono mt-0.5">
            {data.assigned_model}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {data.allowed_tools && data.allowed_tools.length > 0 && (
          <div>
            <div className="text-[8px] uppercase tracking-widest opacity-40 mb-1">
              Tools
            </div>
            <div className="flex flex-wrap gap-1">
              {data.allowed_tools.slice(0, 3).map((t: string) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 bg-[#1A1D21]/5 rounded text-[8px]"
                >
                  {t}
                </span>
              ))}
              {data.allowed_tools.length > 3 && (
                <span className="text-[8px] opacity-40">
                  +{data.allowed_tools.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-[#1A1D21]/5">
          <Database size={10} className="opacity-40" />
          <div className="flex gap-1">
            {data.memory_access?.map((m: string) => (
              <div
                key={m}
                className={`w-2 h-2 rounded-full ${
                  m === "hot"
                    ? "bg-orange-400"
                    : m === "warm"
                    ? "bg-blue-400"
                    : "bg-gray-400"
                }`}
                title={m}
              />
            ))}
          </div>
          <span className="text-[9px] opacity-40 ml-auto">
            {data.max_runtime_seconds}s
          </span>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  agent: AgentNode,
};

export function PolicyGraph({ nodes, edges }: PolicyGraphProps) {
  const [selectedNode, setSelectedNode] = useState<any>(null);

  // Convert policy nodes to ReactFlow nodes with hierarchical positioning
  const flowNodes: Node[] = useMemo(() => {
    const nodeArray = Object.values(nodes);
    if (nodeArray.length === 0) return [];

    // Layout: Clean hierarchy with logger at bottom right to collect from all
    //        gatekeeper (top)
    //             ↓
    //          planner
    //             ↓
    //          executor
    //            ↘
    //             logger (collects from all)
    const positions: Record<string, { x: number; y: number }> = {
      gatekeeper: { x: 200, y: 50 },     // Top left
      planner: { x: 200, y: 280 },       // Below gatekeeper
      executor: { x: 200, y: 510 },      // Below planner
      logger: { x: 520, y: 620 },        // Bottom right - collects logs
    };

    return nodeArray.map((node: any) => ({
      id: node.name,
      type: "agent",
      position: positions[node.name] ?? { x: 250, y: 400 },
      data: node,
    }));
  }, [nodes]);

  // Convert policy edges to ReactFlow edges
  const flowEdges: Edge[] = useMemo(() => {
    const edgeArray: Edge[] = [];
    let edgeId = 0;

    Object.entries(edges).forEach(([source, targets]) => {
      // Skip system node - it's just a placeholder
      if (source === "system") return;

      // Only create edges for nodes that actually exist
      if (!nodes[source]) return;

      targets.forEach((target) => {
        if (nodes[target]) {
          edgeArray.push({
            id: `edge-${edgeId++}`,
            source,
            target,
            type: ConnectionLineType.Bezier,
            animated: true,
            style: {
              stroke: "#1A1D21",
              strokeWidth: 4,
            },
            label: `${source} calls ${target}`,
            labelStyle: {
              fontSize: 12,
              fontWeight: 600,
              fill: "#1A1D21",
            },
            labelBgStyle: {
              fill: "white",
              fillOpacity: 1,
            },
            labelBgPadding: [8, 4] as [number, number],
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#1A1D21",
              width: 20,
              height: 20,
            },
          });
        }
      });
    });

    return edgeArray;
  }, [edges, nodes]);

  const [internalNodes, , onNodesChange] = useNodesState(flowNodes);
  const [internalEdges, , onEdgesChange] = useEdgesState(flowEdges);

  // Debug: log edges to console
  useEffect(() => {
    console.log("[PolicyGraph] Edges:", internalEdges);
    console.log("[PolicyGraph] Nodes:", internalNodes);
  }, [internalEdges, internalNodes]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.data);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-white border border-[#1A1D21]/20 rounded-lg p-4 shadow-lg">
        <div className="text-xs font-bold mb-2 uppercase tracking-wider">Flow Direction</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-12 h-0.5 bg-[#1A1D21] opacity-60 relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[6px] border-l-[#1A1D21] border-y-[4px] border-y-transparent opacity-60" />
            </div>
            <span className="opacity-60">= can call/activate</span>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-[#1A1D21]/10">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="opacity-60">Hot memory</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="opacity-60">Warm memory</span>
          </div>
        </div>
      </div>

      <ReactFlow
        nodes={internalNodes}
        edges={internalEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        minZoom={0.4}
        maxZoom={1.5}
        defaultViewport={{ x: 100, y: 50, zoom: 0.9 }}
        className="bg-[#F3F2EE]"
      >
        <Background color="#1A1D21" gap={20} size={1} style={{ opacity: 0.05 }} />
        <Controls
          className="bg-white border border-[#1A1D21]/10 rounded-lg shadow-sm"
          style={{ button: { backgroundColor: "#F3F2EE" } }}
        />
        <MiniMap
          nodeColor={(node) => "#1A1D21"}
          maskColor="rgba(243, 242, 238, 0.8)"
          className="bg-white border border-[#1A1D21]/10 rounded-lg shadow-sm"
          style={{ opacity: 0.8 }}
        />
      </ReactFlow>

      {/* Node detail panel */}
      {selectedNode && (
        <div className="absolute top-4 right-4 bg-white border border-[#1A1D21]/20 rounded-xl p-6 shadow-xl w-[320px] max-h-[80vh] overflow-y-auto">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg uppercase tracking-wider">
                {selectedNode.name}
              </h3>
              <div className="text-xs opacity-40 font-mono mt-1">
                {selectedNode.assigned_model}
              </div>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 hover:bg-[#1A1D21]/5 rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest opacity-40 mb-2 flex items-center gap-1">
                <Share2 size={12} />
                Allowed Callers
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedNode.allowed_callers.map((c: string) => (
                  <span
                    key={c}
                    className="px-2 py-1 bg-[#F3F2EE] border border-[#1A1D21]/10 rounded text-xs"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest opacity-40 mb-2 flex items-center gap-1">
                <Zap size={12} />
                Allowed Tools
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedNode.allowed_tools.length > 0 ? (
                  selectedNode.allowed_tools.map((t: string) => (
                    <span
                      key={t}
                      className="px-2 py-1 bg-[#1A1D21]/5 rounded text-xs"
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-xs opacity-30 italic">None</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest opacity-40 mb-2 flex items-center gap-1">
                <Database size={12} />
                Memory Access
              </div>
              <div className="space-y-1">
                {selectedNode.memory_access.map((m: string) => (
                  <div key={m} className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        m === "hot"
                          ? "bg-orange-400"
                          : m === "warm"
                          ? "bg-blue-400"
                          : "bg-gray-400"
                      }`}
                    />
                    <span className="text-xs capitalize">{m}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#1A1D21]/10">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="opacity-40 mb-1">Max Runtime</div>
                  <div className="font-medium">
                    {selectedNode.max_runtime_seconds}s
                  </div>
                </div>
                <div>
                  <div className="opacity-40 mb-1">Max Tokens</div>
                  <div className="font-medium">
                    {selectedNode.max_tokens_per_call.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
