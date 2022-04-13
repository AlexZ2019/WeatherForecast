import { ApolloClient, createHttpLink, from, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getLocalStorageValue, setTokensToLocalStorage } from '../../utils/localStorage';
import { onError } from '@apollo/client/link/error';
import { REFRESH_TOKEN_MUTATION } from '../../modules/auth/graphql/mutations/refreshToken';
import config from '../../config';

const httpLink = createHttpLink({
  uri: config.serverApI
});

const authLink = setContext((_, { headers }) => {
  const accessToken = getLocalStorageValue('accessToken');
  if (accessToken) {
    return {
      headers: {
        ...headers,
        authorization: `Bearer ${accessToken}`
      }
    };
  }
});

export const refreshTokenClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache()
});

const refreshTokens = async (refreshToken: string | null) => {
  try {
    const response = await refreshTokenClient.mutate({
      mutation: REFRESH_TOKEN_MUTATION,
      context: {
        headers: {
          authorization: `Bearer ${refreshToken}`
        }
      }
    });

    return response.data.refreshToken;
  } catch (e) {
    throw e;
  }
};

const errorLink = onError(
  ({ graphQLErrors, networkError, operation, forward }) => {
    (async () => {
      if (graphQLErrors) {
        for (const { extensions } of graphQLErrors) {
          switch (extensions.code) {
            case 'UNAUTHENTICATED':
              const tokens = await refreshTokens(getLocalStorageValue('refreshToken'));
              setTokensToLocalStorage(tokens);
              operation.setContext({
                headers: {
                  ...operation.getContext().headers,
                  authorization: `Bearer ${tokens.accessToken}`
                }
              });

              return forward(operation);
          }
        }
      }
    })();
  });

export const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache()
});
