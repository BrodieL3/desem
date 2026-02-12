import {type SchemaTypeDefinition} from 'sanity'

import {defenseStoryType} from './defenseStoryType'
import {analystViewType} from './objects/analystViewType'
import {notableLinkType} from './objects/notableLinkType'
import {viewFromType} from './objects/viewFromType'

export const schema: {types: SchemaTypeDefinition[]} = {
  types: [defenseStoryType, analystViewType, viewFromType, notableLinkType],
}
