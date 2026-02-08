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
  darkMode?: boolean;
}

// Theme helpers
function getTheme(dark: boolean) {
  return {
    bg: dark ? '#1c1c1c' : '#F3F2EE',
    fg: dark ? '#E5E5E5' : '#1A1D21',
    border: dark ? 'rgba(255,255,255,0.15)' : 'rgba(26,29,33,0.3)',
    borderSubtle: dark ? 'rgba(255,255,255,0.08)' : 'rgba(26,29,33,0.05)',
    cardBg: dark ? '#2a2a2a' : '#F3F2EE',
    panelBg: dark ? '#252525' : '#ffffff',
    subtleBg: dark ? 'rgba(255,255,255,0.06)' : 'rgba(26,29,33,0.05)',
    tagBg: dark ? 'rgba(255,255,255,0.08)' : 'rgba(26,29,33,0.05)',
    dotColor: dark ? '#555' : '#1A1D21',
    maskColor: dark ? 'rgba(28,28,28,0.8)' : 'rgba(243,242,238,0.8)',
    edgeLabelBg: dark ? '#2a2a2a' : '#ffffff',
  };
}

// Custom node component that shows agent details
function AgentNode({ data }: { data: any }) {
  const dark = data._darkMode ?? false;
  const t = getTheme(dark);

  const getIcon = (name: string) => {
    if (name === "gatekeeper") return <Shield size={20} />;
    if (name === "planner") return <Zap size={20} />;
    return <Cpu size={20} />;
  };

  return (
    <div
      className="rounded-xl p-4 shadow-lg min-w-[220px] hover:shadow-xl transition-all"
      style={{
        backgroundColor: t.cardBg,
        border: `2px solid ${t.border}`,
        color: t.fg,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: t.subtleBg }}>
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
              {data.allowed_tools.slice(0, 3).map((tool: string) => (
                <span
                  key={tool}
                  className="px-1.5 py-0.5 rounded text-[8px]"
                  style={{ backgroundColor: t.tagBg }}
                >
                  {tool}
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

        <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
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

export function PolicyGraph({ nodes, edges, darkMode = false }: PolicyGraphProps) {
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const t = getTheme(darkMode);

  // Convert policy nodes to ReactFlow nodes with hierarchical positioning
  const flowNodes: Node[] = useMemo(() => {
    const nodeArray = Object.values(nodes);
    if (nodeArray.length === 0) return [];

    const positions: Record<string, { x: number; y: number }> = {
      gatekeeper: { x: 200, y: 50 },
      planner: { x: 200, y: 280 },
      executor: { x: 200, y: 510 },
      logger: { x: 520, y: 620 },
    };

    return nodeArray.map((node: any) => ({
      id: node.name,
      type: "agent",
      position: positions[node.name] ?? { x: 250, y: 400 },
      data: { ...node, _darkMode: darkMode },
    }));
  }, [nodes, darkMode]);

  // Convert policy edges to ReactFlow edges
  const flowEdges: Edge[] = useMemo(() => {
    const edgeArray: Edge[] = [];
    let edgeId = 0;

    Object.entries(edges).forEach(([source, targets]) => {
      if (source === "system") return;
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
              stroke: t.fg,
              strokeWidth: 4,
            },
            label: `${source} calls ${target}`,
            labelStyle: {
              fontSize: 12,
              fontWeight: 600,
              fill: t.fg,
            },
            labelBgStyle: {
              fill: t.edgeLabelBg,
              fillOpacity: 1,
            },
            labelBgPadding: [8, 4] as [number, number],
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: t.fg,
              width: 20,
              height: 20,
            },
          });
        }
      });
    });

    return edgeArray;
  }, [edges, nodes, darkMode]);

  const [internalNodes, , onNodesChange] = useNodesState(flowNodes);
  const [internalEdges, , onEdgesChange] = useEdgesState(flowEdges);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.data);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Legend */}
      <div
        className="absolute top-4 left-4 z-10 rounded-lg p-4 shadow-lg"
        style={{ backgroundColor: t.panelBg, border: `1px solid ${t.border}`, color: t.fg }}
      >
        <div className="text-xs font-bold mb-2 uppercase tracking-wider">Flow Direction</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-12 h-0.5 opacity-60 relative" style={{ backgroundColor: t.fg }}>
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[4px] border-y-transparent opacity-60"
                style={{ borderLeftWidth: 6, borderLeftColor: t.fg }}
              />
            </div>
            <span className="opacity-60">= can call/activate</span>
          </div>
          <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
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
        style={{ backgroundColor: t.bg }}
      >
        <Background color={t.dotColor} gap={20} size={1} style={{ opacity: 0.05 }} />
        <Controls />
        <MiniMap
          nodeColor={() => t.fg}
          maskColor={t.maskColor}
          style={{ opacity: 0.8 }}
        />
      </ReactFlow>

      {/* Node detail panel */}
      {selectedNode && (
        <div
          className="absolute top-4 right-4 rounded-xl p-6 shadow-xl w-[320px] max-h-[80vh] overflow-y-auto"
          style={{ backgroundColor: t.panelBg, border: `1px solid ${t.border}`, color: t.fg }}
        >
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
              className="p-1 rounded transition-opacity opacity-60 hover:opacity-100"
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
                    className="px-2 py-1 rounded text-xs"
                    style={{ backgroundColor: t.tagBg, border: `1px solid ${t.borderSubtle}` }}
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
                  selectedNode.allowed_tools.map((tool: string) => (
                    <span
                      key={tool}
                      className="px-2 py-1 rounded text-xs"
                      style={{ backgroundColor: t.tagBg }}
                    >
                      {tool}
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

            <div className="pt-4" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
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
