export interface PlannedFile {
  relativePath: string
  contents: string | Buffer
  encoding: 'utf8' | 'binary'
}
