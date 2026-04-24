export interface SimResult {
  samplePaths: number[][]   // ~60 paths for rendering
  p10:         number[]
  p50:         number[]
  p90:         number[]
  probTarget:  number
  finalVals:   number[]
  labels:      string[]
}
