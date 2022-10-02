const COMMIT_ANALYZER = [
    '@semantic-release/commit-analyzer',
    {
        preset: 'eslint',
        releaseRules: [
            { tag: 'Breaking', release: 'major' },
            { tag: 'New', release: 'minor' },
            { tag: 'Update', release: 'minor' },
            { tag: 'Fix', release: 'patch' },
            { tag: 'Upgrade', release: 'patch' }
        ]
    }
];

const RELEASE_NOTES_GENERATOR = [
    '@semantic-release/release-notes-generator',
    {
        preset: 'eslint'
    }
];

const NPM = '@semantic-release/npm';

const GITHUB = '@semantic-release/github';

const DOCKER = [
    '@codedependant/semantic-release-docker',
    {
        dockerTags: ['latest', '{{version}}'],
        dockerRegistry: process.env.REGISTRY,
        dockerLogin: false
    }
]


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
        GITHUB,
        DOCKER
    ]
};
