[@ai16z/eliza v0.1.5-alpha.3](../index.md) / State

# Interface: State

Represents the current state/context of a conversation

## Indexable

 \[`key`: `string`\]: `unknown`

## Properties

### userId?

> `optional` **userId**: \`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

ID of user who sent current message

#### Defined in

packages/core/src/types.ts:239

***

### agentId?

> `optional` **agentId**: \`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

ID of agent in conversation

#### Defined in

packages/core/src/types.ts:242

***

### bio

> **bio**: `string`

Agent's biography

#### Defined in

packages/core/src/types.ts:245

***

### lore

> **lore**: `string`

Agent's background lore

#### Defined in

packages/core/src/types.ts:248

***

### messageDirections

> **messageDirections**: `string`

Message handling directions

#### Defined in

packages/core/src/types.ts:251

***

### postDirections

> **postDirections**: `string`

Post handling directions

#### Defined in

packages/core/src/types.ts:254

***

### roomId

> **roomId**: \`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

Current room/conversation ID

#### Defined in

packages/core/src/types.ts:257

***

### agentName?

> `optional` **agentName**: `string`

Optional agent name

#### Defined in

packages/core/src/types.ts:260

***

### senderName?

> `optional` **senderName**: `string`

Optional message sender name

#### Defined in

packages/core/src/types.ts:263

***

### actors

> **actors**: `string`

String representation of conversation actors

#### Defined in

packages/core/src/types.ts:266

***

### actorsData?

> `optional` **actorsData**: [`Actor`](Actor.md)[]

Optional array of actor objects

#### Defined in

packages/core/src/types.ts:269

***

### goals?

> `optional` **goals**: `string`

Optional string representation of goals

#### Defined in

packages/core/src/types.ts:272

***

### goalsData?

> `optional` **goalsData**: [`Goal`](Goal.md)[]

Optional array of goal objects

#### Defined in

packages/core/src/types.ts:275

***

### recentMessages

> **recentMessages**: `string`

Recent message history as string

#### Defined in

packages/core/src/types.ts:278

***

### recentMessagesData

> **recentMessagesData**: [`Memory`](Memory.md)[]

Recent message objects

#### Defined in

packages/core/src/types.ts:281

***

### actionNames?

> `optional` **actionNames**: `string`

Optional valid action names

#### Defined in

packages/core/src/types.ts:284

***

### actions?

> `optional` **actions**: `string`

Optional action descriptions

#### Defined in

packages/core/src/types.ts:287

***

### actionsData?

> `optional` **actionsData**: [`Action`](Action.md)[]

Optional action objects

#### Defined in

packages/core/src/types.ts:290

***

### actionExamples?

> `optional` **actionExamples**: `string`

Optional action examples

#### Defined in

packages/core/src/types.ts:293

***

### providers?

> `optional` **providers**: `string`

Optional provider descriptions

#### Defined in

packages/core/src/types.ts:296

***

### responseData?

> `optional` **responseData**: [`Content`](Content.md)

Optional response content

#### Defined in

packages/core/src/types.ts:299

***

### recentInteractionsData?

> `optional` **recentInteractionsData**: [`Memory`](Memory.md)[]

Optional recent interaction objects

#### Defined in

packages/core/src/types.ts:302

***

### recentInteractions?

> `optional` **recentInteractions**: `string`

Optional recent interactions string

#### Defined in

packages/core/src/types.ts:305

***

### formattedConversation?

> `optional` **formattedConversation**: `string`

Optional formatted conversation

#### Defined in

packages/core/src/types.ts:308

***

### knowledge?

> `optional` **knowledge**: `string`

Optional formatted knowledge

#### Defined in

packages/core/src/types.ts:311

***

### knowledgeData?

> `optional` **knowledgeData**: [`KnowledgeItem`](../type-aliases/KnowledgeItem.md)[]

Optional knowledge data

#### Defined in

packages/core/src/types.ts:313
