import React, { useMemo, useRef } from 'react';
import ForceGraph3D from 'react-force-graph-3d';

type NodeType = 'caregiver' | 'patient' | 'family';

interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;
}

interface RelationshipData {
  caregiver: { _id?: string; id?: string; full_name: string };
  patients: Array<{
    patient: { _id?: string; id?: string; full_name: string };
    family_members: Array<{ _id?: string; id?: string; full_name: string }>;
  }>;
}

interface RelationshipGraph3DProps {
  relationships: RelationshipData[];
}

export const RelationshipGraph3D = ({ relationships }: RelationshipGraph3DProps) => {
  const fgRef = useRef<any>(null);

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    const addNode = (id: string, name: string, type: NodeType) => {
      if (!nodes.some((n) => n.id === id)) {
        nodes.push({ id, name, type });
      }
    };

    // Process each caregiver and their relationships
    relationships.forEach((rel) => {
      const cg = rel.caregiver;
      const caregiverId = `cg-${cg._id || cg.id}`;

      addNode(caregiverId, cg.full_name, 'caregiver');

      // Process patients and their family members
      rel.patients.forEach((item) => {
        const p = item.patient;
        const familyMembers = item.family_members || [];

        const patientId = `p-${p._id || p.id}`;
        addNode(patientId, p.full_name, 'patient');

        // Link caregiver to patient
        links.push({ source: caregiverId, target: patientId, label: 'cares for' });

        // Link patient to each family member
        familyMembers.forEach((f) => {
          const familyId = `f-${f._id || f.id}`;
          addNode(familyId, f.full_name, 'family');
          links.push({ source: patientId, target: familyId, label: 'family' });
        });
      });
    });

    return { nodes, links };
  }, [relationships]);

  const getNodeColor = (node: any) => {
    const colors: { [key in NodeType]: string } = {
      caregiver: '#3b82f6', // blue
      patient: '#10b981', // emerald
      family: '#f59e0b', // amber
    };
    return colors[node.type as NodeType] || '#6b7280';
  };

  return (
    <div className="relative w-full" style={{ height: '70vh' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        nodeLabel={(n: any) => `${n.name} (${n.type})`}
        nodeColor={getNodeColor}
        linkLabel={(l: any) => l.label}
        linkColor={() => '#d1d5db'}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.01}
        linkDirectionalParticleWidth={2}
        linkCurvature={0.2}
        linkWidth={1.5}
        onNodeClick={(node: any) => {
          // Smoothly focus camera on clicked node
          const distance = 140;
          const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
          fgRef.current?.cameraPosition(
            {
              x: (node.x || 0) * distRatio,
              y: (node.y || 0) * distRatio,
              z: (node.z || 0) * distRatio,
            },
            { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
            900
          );
        }}
        enableNodeDrag={false}
        enableNavigationControls={true}
        d3AlphaDecay={0.05}
        d3VelocityDecay={0.3}
      />
      <div className="absolute top-2.5 left-2.5 bg-black/70 text-white p-3 rounded-lg text-xs leading-relaxed">
        <div className="mb-2 font-bold">Legend:</div>
        <div>
          <span className="text-blue-400">●</span> Caregiver
        </div>
        <div>
          <span className="text-emerald-400">●</span> Patient
        </div>
        <div>
          <span className="text-amber-400">●</span> Family Member
        </div>
        <div className="mt-2 text-xs text-gray-400">
          Drag to rotate • Scroll to zoom • Click node to focus
        </div>
      </div>
    </div>
  );
};
