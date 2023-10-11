import type { Tapleaf, Taptree } from "bitcoinjs-lib/src/types"

type Inputs = { weight: number, leaf: Tapleaf }[]
type Node = {
  weight: number,
  node: Taptree
}

class SortedList<T> {
  constructor(
    private array: Array<T>,
    private compare: (a: T, b: T) => number
  ) {
    this.array.sort(compare)
  }

  public pop() {
    return this.array.shift()
  }

  public insert(element: T) {
    let high = this.array.length - 1
    let low = 0
    let mid
    let highElement, lowElement, midElement
    let compareHigh, compareLow, compareMid
    let targetIndex
    while (true) {
      if (high < low) {
        targetIndex = low
        break
      }

      mid = Math.floor((low + high) / 2)

      highElement = this.array[high]
      lowElement = this.array[low]
      midElement = this.array[mid]

      compareHigh = this.compare(element, highElement)
      compareLow = this.compare(element, lowElement)
      compareMid = this.compare(element, midElement)

      if (low === high) {
        // Target index is either to the left or right of element at low
        if (compareLow <= 0) targetIndex = low
        else targetIndex = low + 1
        break
      }

      if (compareHigh >= 0) {
        // Target index is to the right of high
        low = high
        continue
      }
      if (compareLow <= 0) {
        // Target index is to the left of low
        high = low
        continue
      }

      if (compareMid <= 0) {
        // Target index is to the left of mid
        high = mid
        continue
      }

      // Target index is to the right of mid
      low = mid + 1
    }

    this.array.splice(targetIndex, 0, element)
    return targetIndex
  }

  public length() {
    return this.array.length
  }

  public toArray() {
    return this.array
  }
}

/**
 * https://dev.to/eunovo/minimalizing-witness-weight-for-taproot-spend-script-paths-with-huffmans-algorithm-1j74
 * @param inputs
 * @returns
 */
export function sortScriptsIntoTree(inputs: Inputs): Taptree | undefined {
  const nodes: Node[] = inputs
    .map((value) => ({
      weight: value.weight,
      node: value.leaf
    }))

  const sortedNodes = new SortedList(
    nodes,
    (a, b) => a.weight - b.weight
  ) // Create a list sorted in ascending order of frequency

  let newNode: Node
  let nodeA: Node, nodeB: Node
  while (sortedNodes.length() > 1) {
    // Construct a new node from the two nodes with the least frequency
    nodeA = sortedNodes.pop()! // There will always be an element to pop
    nodeB = sortedNodes.pop()! // because loop ends when length <= 1
    newNode = {
      weight: nodeA.weight + nodeB.weight,
      node: [nodeA.node, nodeB.node]
    }
    // Place newNode back into sorted list
    sortedNodes.insert(newNode)
  }

  // Last node in sortedNodes is the root node
  const root = sortedNodes.pop()
  return root?.node
}