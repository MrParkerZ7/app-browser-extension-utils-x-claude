pipeline {
    agent any

    environment {
        REPORTS_DIR = 'security-reports'
        SBOM_DIR = 'sbom'
        DOCKER_IMAGE = 'app-extension-browser'
        DOCKER_TAG = "${BUILD_NUMBER}"

        // SonarQube
        SONAR_HOST_URL = "${params.SONAR_HOST_URL ?: 'http://sonarqube:9000'}"
        SONAR_PROJECT_KEY = "${params.SONAR_PROJECT_KEY ?: 'app-extension-browser-utils'}"
    }

    parameters {
        booleanParam(name: 'SKIP_SONAR', defaultValue: false, description: 'Skip SonarQube scan')
        string(name: 'SONAR_HOST_URL', defaultValue: 'http://sonarqube:9000', description: 'SonarQube server URL')
        string(name: 'SONAR_PROJECT_KEY', defaultValue: 'app-extension-browser-utils', description: 'SonarQube project key')
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {

        //=======================================================================
        // STAGE 1: CHECKOUT & INIT
        //=======================================================================
        stage('Checkout & Init') {
            steps {
                checkout scm

                sh '''
                    mkdir -p ${REPORTS_DIR} ${SBOM_DIR}
                    echo "=== Build Info ==="
                    echo "Build: ${BUILD_NUMBER}"
                    echo "Date: $(date)"
                    echo "Node: $(node --version || echo 'not installed')"
                    echo "=================="
                '''
            }
        }

        //=======================================================================
        // STAGE 2: INSTALL DEPENDENCIES
        //=======================================================================
        stage('Install Dependencies') {
            steps {
                sh '''
                    echo "Installing dependencies..."
                    npm ci
                '''
            }
        }

        //=======================================================================
        // STAGE 3: CODE QUALITY CHECKS
        //=======================================================================
        stage('Code Quality') {
            parallel {
                stage('Lint') {
                    steps {
                        sh '''
                            echo "Running ESLint..."
                            npm run lint
                        '''
                    }
                }

                stage('Format') {
                    steps {
                        sh '''
                            echo "Running Prettier..."
                            npm run format
                        '''
                    }
                }
            }
        }

        //=======================================================================
        // STAGE 4: CLEAN & BUILD
        //=======================================================================
        stage('Clean & Build') {
            steps {
                sh '''
                    echo "Cleaning previous build..."
                    npm run clean

                    echo "Building extension..."
                    npm run build
                '''
            }
        }

        //=======================================================================
        // STAGE 5: TEST
        //=======================================================================
        stage('Test') {
            steps {
                sh '''
                    echo "Running tests..."
                    npm test -- --ci --coverage
                '''
            }
            post {
                always {
                    // Archive test coverage reports if generated
                    archiveArtifacts artifacts: 'coverage/**/*', allowEmptyArchive: true
                }
            }
        }

        //=======================================================================
        // STAGE 6: PRE-BUILD SECURITY SCANS
        //=======================================================================
        stage('Pre-Build Security Scans') {
            parallel {

                // Secret Detection
                stage('Secrets Detection') {
                    steps {
                        script {
                            sh '''
                                echo "Running Gitleaks..."
                                gitleaks detect \
                                    --source . \
                                    --report-format json \
                                    --report-path ${REPORTS_DIR}/gitleaks-report.json \
                                    --verbose 2>&1 | tee ${REPORTS_DIR}/gitleaks.log || true

                                if [ -f ${REPORTS_DIR}/gitleaks-report.json ]; then
                                    SECRETS=$(cat ${REPORTS_DIR}/gitleaks-report.json | jq '. | length' 2>/dev/null || echo "0")
                                    echo "Secrets found: ${SECRETS}"
                                fi
                            '''
                        }
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: "${REPORTS_DIR}/gitleaks-report.json", allowEmptyArchive: true
                        }
                    }
                }

                // IaC Scan
                stage('IaC Security Scan') {
                    steps {
                        sh '''
                            echo "Running Checkov..."
                            checkov \
                                --directory . \
                                --output json \
                                --output-file-path ${REPORTS_DIR} \
                                --soft-fail \
                                || true
                        '''
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: "${REPORTS_DIR}/results_json.json", allowEmptyArchive: true
                        }
                    }
                }
            }
        }

        //=======================================================================
        // STAGE 7: CODE ANALYSIS
        //=======================================================================
        stage('Code Analysis') {
            parallel {

                // SAST with Semgrep
                stage('SAST - Semgrep') {
                    steps {
                        script {
                            sh '''
                                echo "Running Semgrep..."
                                semgrep scan \
                                    --config auto \
                                    --config p/javascript \
                                    --config p/typescript \
                                    --config p/security-audit \
                                    --config p/secrets \
                                    --json \
                                    --output ${REPORTS_DIR}/semgrep-report.json \
                                    --exclude node_modules \
                                    --exclude dist \
                                    --exclude '*.min.js' \
                                    . || true

                                if [ -f ${REPORTS_DIR}/semgrep-report.json ]; then
                                    FINDINGS=$(cat ${REPORTS_DIR}/semgrep-report.json | jq '.results | length' 2>/dev/null || echo "0")
                                    echo "Semgrep findings: ${FINDINGS}"
                                fi
                            '''
                        }
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: "${REPORTS_DIR}/semgrep-report.json", allowEmptyArchive: true
                        }
                    }
                }

                // SonarQube Analysis
                stage('SAST - SonarQube') {
                    when {
                        not { expression { params.SKIP_SONAR } }
                    }
                    steps {
                        script {
                            sh '''
                                echo "Running SonarQube analysis..."

                                # Check if SonarQube is reachable
                                if curl -s -o /dev/null -w "%{http_code}" ${SONAR_HOST_URL}/api/system/status | grep -q "200"; then
                                    echo "SonarQube is available at ${SONAR_HOST_URL}"

                                    # Run sonar-scanner using Docker
                                    docker run --rm \
                                        --network security-pipeline-network \
                                        -v "$(pwd):/usr/src" \
                                        -w /usr/src \
                                        sonarsource/sonar-scanner-cli:latest \
                                        -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                                        -Dsonar.projectName="App Extension Browser Utils" \
                                        -Dsonar.sources=src \
                                        -Dsonar.host.url=${SONAR_HOST_URL} \
                                        -Dsonar.login=admin \
                                        -Dsonar.password=admin \
                                        -Dsonar.exclusions=node_modules/**,dist/**,coverage/**,**/*.test.ts,**/*.spec.ts \
                                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                                        || echo "SonarQube scan completed with warnings"

                                    echo "SonarQube dashboard: ${SONAR_HOST_URL}/dashboard?id=${SONAR_PROJECT_KEY}"
                                else
                                    echo "WARNING: SonarQube is not available at ${SONAR_HOST_URL}"
                                    echo "Skipping SonarQube analysis"
                                fi
                            '''
                        }
                    }
                }

                // Dependency Scan
                stage('SCA - Dependency Check') {
                    steps {
                        script {
                            sh '''
                                echo "Running Trivy filesystem scan..."
                                trivy fs \
                                    --scanners vuln \
                                    --format json \
                                    --output ${REPORTS_DIR}/trivy-fs-report.json \
                                    --severity CRITICAL,HIGH,MEDIUM \
                                    . || true

                                if [ -f ${REPORTS_DIR}/trivy-fs-report.json ]; then
                                    echo "Trivy scan completed"
                                fi
                            '''
                        }
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: "${REPORTS_DIR}/trivy-fs-report.json", allowEmptyArchive: true
                        }
                    }
                }

                // SBOM Generation
                stage('SBOM Generation') {
                    steps {
                        sh '''
                            echo "Generating SBOM..."
                            syft . \
                                --output cyclonedx-json=${SBOM_DIR}/sbom-cyclonedx.json \
                                --output spdx-json=${SBOM_DIR}/sbom-spdx.json \
                                || true

                            if [ -f ${SBOM_DIR}/sbom-cyclonedx.json ]; then
                                PACKAGES=$(cat ${SBOM_DIR}/sbom-cyclonedx.json | jq '.components | length' 2>/dev/null || echo "unknown")
                                echo "Packages in SBOM: ${PACKAGES}"
                            fi
                        '''
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: "${SBOM_DIR}/*.json", allowEmptyArchive: true
                        }
                    }
                }

                // License Scan
                stage('License Compliance') {
                    steps {
                        sh '''
                            echo "Running license scan..."
                            trivy fs \
                                --scanners license \
                                --format json \
                                --output ${REPORTS_DIR}/license-report.json \
                                . || true
                        '''
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: "${REPORTS_DIR}/license-report.json", allowEmptyArchive: true
                        }
                    }
                }
            }
        }

        //=======================================================================
        // STAGE 8: DOCKER BUILD & SCAN
        //=======================================================================
        stage('Docker Build & Scan') {
            steps {
                script {
                    sh '''
                        echo "Building Docker image..."
                        docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} .
                        docker tag ${DOCKER_IMAGE}:${DOCKER_TAG} ${DOCKER_IMAGE}:latest
                    '''

                    sh '''
                        echo "Scanning Docker image with Trivy..."
                        trivy image \
                            --format json \
                            --output ${REPORTS_DIR}/trivy-image-report.json \
                            --severity CRITICAL,HIGH,MEDIUM \
                            ${DOCKER_IMAGE}:${DOCKER_TAG} || true

                        if [ -f ${REPORTS_DIR}/trivy-image-report.json ]; then
                            echo "Docker image scan completed"
                        fi
                    '''
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: "${REPORTS_DIR}/trivy-image-report.json", allowEmptyArchive: true
                }
            }
        }

        //=======================================================================
        // STAGE 9: SECURITY SUMMARY
        //=======================================================================
        stage('Security Summary') {
            steps {
                script {
                    sh '''
                        echo "============================================"
                        echo "         SECURITY SCAN SUMMARY"
                        echo "============================================"
                        echo ""
                        echo "Build: ${BUILD_NUMBER}"
                        echo "Date: $(date)"
                        echo ""
                        echo "Reports generated:"
                        ls -la ${REPORTS_DIR}/ 2>/dev/null || echo "No reports"
                        echo ""
                        echo "SBOM artifacts:"
                        ls -la ${SBOM_DIR}/ 2>/dev/null || echo "No SBOM"
                        echo ""
                        echo "============================================"
                    '''

                    // Generate summary JSON
                    sh '''
                        cat > ${REPORTS_DIR}/security-summary.json << EOF
{
  "build_number": "${BUILD_NUMBER}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "project": "app-browser-extension-utils",
  "scanners": {
    "secrets": "gitleaks",
    "sast": ["semgrep", "sonarqube"],
    "sca": "trivy",
    "iac": "checkov",
    "sbom": "syft",
    "container": "trivy-image",
    "code_quality": "sonarqube"
  },
  "sonarqube_url": "${SONAR_HOST_URL}/dashboard?id=${SONAR_PROJECT_KEY}",
  "status": "completed"
}
EOF
                    '''
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: "${REPORTS_DIR}/**/*", allowEmptyArchive: true
                }
            }
        }
    }

    //===========================================================================
    // POST ACTIONS
    //===========================================================================
    post {
        always {
            echo "Pipeline completed"
        }

        failure {
            echo "Pipeline FAILED - check security scan reports"
        }

        success {
            echo "Pipeline SUCCEEDED - all security scans completed"
            echo "View SonarQube results at: ${SONAR_HOST_URL}/dashboard?id=${SONAR_PROJECT_KEY}"
        }
    }
}
