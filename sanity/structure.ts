import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Defense Desk')
    .items([
      S.documentTypeListItem('defenseStory').title('Defense Stories'),
      S.divider(),
      ...S.documentTypeListItems().filter((item) => item.getId() && item.getId() !== 'defenseStory'),
    ])
