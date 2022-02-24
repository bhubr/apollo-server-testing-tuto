# Introduction aux tests d'intégration avec Apollo Server

> Version initiale : février 2022

Cet article s'inspire de la section [Integration testing](https://www.apollographql.com/docs/apollo-server/testing/testing/) de la documentation d'Apollo Server (v3 au moment où j'écris).

## Pourquoi tester ? Que tester ?

D'une façon générale, tester son code permet :

* De vérifier qu'il répond bien à des spécifications, qu'il fait ce qu'on attend de lui.
* De vérifier qu'une fonctionnalité existante n'est pas cassée par l'ajout de nouveau code ("non-régression")

Toujours de façon générale, du code va agir sur des données d'entrée, et produire un certain résultat en sortie.

### Exemple simple

Contexte : une fonction qui calcule une moyenne sur un tableau de nombres `[4, 8, 9]` devrait renvoyer `7` (somme des nombres &rarr; `21`, divisée par trois &rarr; `7`).

Un exemple de test "naïf" (sans utiliser d'outil particulier, et en écrivant le code et le test dans le même fichier) :

```typescript
// Code à tester - implémentation simple
function computeAverage(numbersList: number[]): number {
  // Initialise une variable qui stockera la somme
  let sum = 0;

  // Additionne tous les nombres
  for (let i = 0; i < numbersList.length; i++) {
    sum += numbersList[i];
  }

  // Renvoye la somme divisée par le nombre d'éléments
  return sum / numbersList.length;
}

// "Test" - Si la valeur calculée est différente de celle attendue,
// on "throw" une erreur (le code qui suit le throw ne sera pas exécuté)
const numbers = [4, 8, 9];
// à gauche du !== se trouve la valeur calculée, à droite la valeur attendue
if (computeAverage(numbers) !== 7) {
  throw new Error('Moyenne calculée non-conforme');
}
// Si on arrive ici c'est que la fonction a fait ce qui était attendu
console.log('Test passé !');
```

> :warning: Attention, le test ci-dessus est volontairement simpliste !

Dans un cas réel, le test sera toujours écrit dans un fichier séparé du code à tester.

De plus, on utilisera des outils comme Jest pour pouvoir tester les différents cas. Si on voulait ajouter d'autres tests au code ci-dessus, que se passerait-il ? En cas d'erreur dans le premier test, le `throw` empêcherait de passer aux suivants.

Un outil comme Jest permet de tester plusieurs cas de façon indépendante.

### Exemple plus complexe

Contexte : une fonction "resolver" pour une mutation GraphQL qui sert à enregistrer un utilisateur.

Elle va prendre en entrée au moins deux champs - par exemple email et mot de passe - pouvant être transmis à resolver sous forme d'un objet `{ email: "foo@bar.com", password: "pass" }`.

Si on suit une approche "TDD" stricte, avant même d'écrire le code du resolver, on peut réfléchir aux différents cas pouvant survenir :

* Le "happy path" ("chemin heureux") :

    * SI l'email est valide,
    * ET que le password est conforme (par exemple, nombre de caractères >= 8),
    * ET que l'email n'existe pas déjà dans la BDD,
    * ALORS on inscrit l'utilisateur dans la BDD
* Un ou plusieurs "chemin(s) d'erreur" (ou plus simplement, cas d'erreur) :

    * SI l'email et/ou le password sont vides, renvoyer une erreur
    * SI l'email et/ou le password est invalide, renvoyer une erreur
    * SI l'email et le password sont valides, MAIS que l'email existe déjà dans la BDD, renvoyer une erreur

Il n'est pas toujours faisable / réaliste de tester absolument tous les cas.

## En pratique

On va s'inspirer du code présenté dans la doc d'Apollo Server, en modifiant les "pré-requis" :

* On veut écrire une fonction resolver, pour une query `hello` qui accepte un paramètre `name`. Ce resolver doit renvoyer `hello <name>`. Par exemple `hello Toto` si `name` vaut `"Toto"`.
* Différence avec l'exemple initial : si le paramètre `name` est `null` ou une string vide, on veut renvoyer une erreur.

À nouveau, dans cet exemple, on a tout mis au même endroit, ce qui n'est pas très réaliste.

```typescript
import { ApolloServer, UserInputError } from 'apollo-server';

const typeDefs = gql`
  type Query {
    hello(name: String): String!
  }
`;

const resolvers = {
  Query: {
    // ICI, différence d'implémentation avec l'exemple original
    hello: (_, { name }) => {
      // Si name est absent/vide, on renvoie une erreur particulière
      // (UserInputError qui est une classe héritée de Error)
      if (!name) {
        throw new UserInputError('name should be provided')
      }
      // Sinon on renvoie le nom
      return `Hello ${name}!`,
    }
  },
};

// describe permet d'envelopper une série de tests apparentés
// à l'intérieur, on trouvera les différents cas (cas "normal" et cas d'erreur)
describe('test hello resolver', () => {

  // Initialisation : le même serveur sera utilisé pour les deux tests
  // Notez qu'on ne DÉMARRE PAS le serveur
  const testServer = new ApolloServer({
    typeDefs,
    resolvers
  });

  // Cas optimal/normal : le nom est fourni
  it('returns hello with the provided name', async () => {

    // executeOperation permet d'envoyer une query/mutation
    // comme si le serveur tournait
    const result = await testServer.executeOperation({
      query: 'query SayHelloWorld($name: String) { hello(name: $name) }',
      variables: { name: 'world' },
    });

    // On s'attend (expect) à ce que la propriété `errors` soit undefined
    expect(result.errors).toBeUndefined();
    // On s'attend à ce que le résultat retourné soit "Hello world"
    expect(result.data?.hello).toBe('Hello world!');
  });

  // Cas d'erreur : le nom n'est pas fourni
  it('returns an error', async () => {

    const result = await testServer.executeOperation({
      query: 'query SayHelloWorld($name: String) { hello(name: $name) }',
      variables: { name: '' },
    });

    // `errors` ne DOIT PAS être undefined
    expect(result.errors).toBeDefined();
    // data.hello DOIT être null
    expect(result.data?.hello).toBe(null);
  });
})

```