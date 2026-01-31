pipeline {
    agent any

    environment {
        REPORTS_DIR = 'security-reports'
        SBOM_DIR = 'sbom'
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
        // STAGE 2: PRE-BUILD SECURITY SCANS
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
        // STAGE 3: CODE ANALYSIS
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
        // STAGE 4: SECURITY SUMMARY
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
                        cat > ${REPORTS_DIR}/security-summary.json << 'EOFSUM'
{
  "build_number": "${BUILD_NUMBER}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "project": "app-browser-extension-utils",
  "scanners": {
    "secrets": "gitleaks",
    "sast": "semgrep",
    "sca": "trivy",
    "iac": "checkov",
    "sbom": "syft"
  },
  "status": "completed"
}
EOFSUM
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
        }
    }
}
