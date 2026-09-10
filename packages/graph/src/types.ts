/**
 * NodeId는 DB의 participant id(UUID)를 그대로 쓴다.
 * 이 패키지는 UI/DB/HTTP를 전혀 알지 못하는 순수 로직이어야 하므로,
 * "누가 누구인지"에 대한 어떤 정보도 다루지 않고 오직 id 문자열만 다룬다.
 */
export type NodeId = string;

export interface Edge {
  a: NodeId;
  b: NodeId;
}

/** 인접 리스트. 그래프 로직 내부 표현이며 외부에 노출하지 않는다. */
export type AdjacencyList = ReadonlyMap<NodeId, ReadonlySet<NodeId>>;
