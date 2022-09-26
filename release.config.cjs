const COMMIT_ANALYZER = [
    '@semantic-release/commit-analyzer',
    {
        preset: 'eslint'
    }
];

const RELEASE_NOTES_GENERATOR = [
    '@semantic-release/release-notes-generator',
    {
        preset: 'eslint'
    }
];

const NPM = '@semantic-release/npm';

const HELM = [
    "semantic-release-helm3",
    {
        chartPath: './helm'
    }
];

const GITHUB = '@semantic-release/github';


module.exports = {
    branches: [
        '+([0-9])?(.{+([0-9]),x}).x',
        'main',
        { name: 'next', prerelease: true }
    ],
    plugins: [
        COMMIT_ANALYZER,
        RELEASE_NOTES_GENERATOR,
        NPM,
        HELM,
        GITHUB
    ]
};
