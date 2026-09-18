import { toConstName } from '../../shared/spec'

export function toPascalIdent(id: string): string {
  return id
    .split('_')
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('')
}

export function entityClassName(id: string): string {
  return `${toPascalIdent(id)}Entity`
}

export function fabricScreenClass(id: string): string {
  const pascal = toPascalIdent(id)
  return pascal.endsWith('Screen') ? pascal : `${pascal}Screen`
}

export function fabricHandlerClass(id: string): string {
  return `${fabricScreenClass(id)}Handler`
}

export function forgeMenuClass(id: string): string {
  if (id === 'example_screen') {
    return 'ExampleMenu'
  }
  const base = id.endsWith('_screen') ? id.slice(0, -7) : id
  const pascal = toPascalIdent(base)
  return pascal.endsWith('Menu') ? pascal : `${pascal}Menu`
}

export function forgeScreenClass(id: string): string {
  return fabricScreenClass(id)
}

export function menuFieldName(id: string): string {
  if (id === 'example_screen' || id === 'example_menu') {
    return 'EXAMPLE_MENU'
  }
  return `${toConstName(id)}_MENU`
}

export function menuRegistryName(id: string): string {
  return id
}
