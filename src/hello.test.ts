// src/hello.test.ts
import { ApolloServer, gql, UserInputError } from 'apollo-server';
import { GraphQLError } from 'graphql';

const typeDefs = gql`
  type Query {
    hello(name: String): String!
  }
`;

const resolvers = {
  Query: {
    // ICI, différence d'implémentation avec l'exemple original
    hello: (_, { name }: { name: string }): string => {
      // Si name est absent/vide, on renvoie une erreur particulière
      // (UserInputError qui est une classe héritée de Error)
      if (!name) {
        throw new UserInputError('name should be provided')
      }
      // Sinon on renvoie le nom
      return `Hello ${name}!`;
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
    // `errors` est un tableau d'objets, chacun contenant une clé message
    const errors = result?.errors as GraphQLError[];
    expect(errors[0]?.message).toBe('name should be provided');
    // data DOIT être null
    expect(result.data).toBe(null);
  });
})